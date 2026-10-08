#!/usr/bin/env node
/**
 * prompt.js - Dispatch prompts to Freebuff in Herdr with focus & modal choreography.
 *
 * Requirements (from SKILL.md):
 * - Auto-detects the Freebuff pane (or uses passed target pane).
 * - Delivers prompt text via Herdr (`herdr pane send-text <pane_id> <prompt>`).
 * - Dynamically navigates focus to Freebuff (`herdr agent focus <pane_id>`).
 * - Allows 500ms for ConPTY/OpenTUI focus propagation.
 * - Delivers submit Enter (`herdr pane send-keys <pane_id> enter`).
 * - Confirms the interactive wallet credit modal automatically (`Enter: confirm and send`).
 * - Restores original caller focus.
 * - Optionally waits for turn completion via `--wait`.
 */

const { spawnSync } = require('child_process');

function runHerdr(args, options = {}) {
  try {
    const res = spawnSync('herdr', args, {
      encoding: 'utf8',
      shell: false,
      ...options,
    });
    if (res.error) throw res.error;
    return res;
  } catch (err) {
    if (options.throwOnError !== false) {
      throw err;
    }
    return { status: 1, stderr: String(err), stdout: '' };
  }
}

function getJson(args) {
  const res = runHerdr(args);
  if (res.status === 0 && res.stdout) {
    try {
      return JSON.parse(res.stdout);
    } catch {}
  }
  return null;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Authoritative submission signal: Herdr's own lifecycle state for the pane.
 * Screen scraping is not trustworthy here -- an unsent multi-KB paste renders as an
 * attachment card that looks identical to a sent message, and the composer's
 * placeholder text is visible in both states.
 */
function getPaneState(paneId) {
  const data = getJson(['pane', 'list']);
  const panes = (data && data.result && data.result.panes) || [];
  const pane = panes.find((p) => p.pane_id === paneId);
  if (!pane) return null;
  return {
    status: pane.agent_status,
    seq: typeof pane.state_change_seq === 'number' ? pane.state_change_seq : null,
  };
}

function getPaneStatus(paneId) {
  const s = getPaneState(paneId);
  return s ? s.status : null;
}

function isActiveStatus(status) {
  return status === 'working' || status === 'blocked';
}

/**
 * Screen-based submission evidence, used only when Herdr's lifecycle tracking is dead.
 *
 * Herdr exposes agent_status / state_change_seq, but both are frozen unless the pane's
 * `status-watcher` is alive. A Freebuff pane that was re-created rather than launched via
 * `freebuff-herdr` has no watcher, so status stays 'idle' forever even for a turn that ran
 * and answered. Observed: 5/5 delivered, 3 reported as failures.
 *
 * Freebuff renders a sent prompt as a "<clipboard> N chars" card in the transcript, followed
 * by the model's answer. An UNSUBMITTED paste renders the same card, but with no answer
 * under it -- the next thing down is the composer. So: a card that has a non-empty answer
 * beneath it is proof the turn ran.
 */
function screenShowsAnsweredTurn(paneId, promptText) {
  const res = runHerdr(['pane', 'read', paneId, '--lines', '60']);
  const lines = (res.stdout || '').split('\n');

  // Identify this prompt's card by its exact character count. Counting cards instead is
  // unsound: the transcript scrolls, so older cards leave the read window and the count
  // DROPS mid-run, which made a delivered prompt look undelivered.
  const want = new RegExp(`${promptText.length.toLocaleString('en-US')}\\s*chars`);
  let cardIdx = -1;
  lines.forEach((l, i) => {
    if (want.test(l)) cardIdx = i;
  });

  if (cardIdx === -1) {
    // Short prompts never become a card -- they are sent inline and carry a "⎘" submit
    // marker. A prompt still sitting in the composer has no such marker.
    const head = promptText.trim().slice(0, 30);
    const headIdx = lines.findIndex((l) => l.includes(head));
    if (headIdx === -1) return false;
    return lines
      .slice(headIdx, headIdx + 4)
      .some((l) => l.includes('⎘'));
  }

  // Scan the lines between that card and the composer for an answer.
  const composerIdx = lines.findIndex((l, i) => i > cardIdx && /Enter a coding task/.test(l));
  const region = lines.slice(cardIdx + 1, composerIdx === -1 ? lines.length : composerIdx);

  return region.some((l) => {
    const t = l.trim();
    if (!t) return false;
    if (/^[│╭╰├─┬┴┼┌└]/.test(t)) return false; // box drawing / ad frame
    if (/Thinking|Add to the current task|⎘|△▽|^\[?\d/.test(t)) return false;
    return t.length > 1;
  });
}

function focusPane(targetId) {
  const panesData = getJson(['pane', 'list']);
  const panes = (panesData && panesData.result && panesData.result.panes) || [];
  const tarP = panes.find((p) => p.pane_id === targetId);

  if (!tarP) {
    runHerdr(['agent', 'focus', targetId]);
    return;
  }

  // Find neighbor pane in the same workspace to establish directional relationship
  const neighbors = panes.filter(
    (p) => p.pane_id !== targetId && p.workspace_id === tarP.workspace_id
  );

  const layoutData = getJson(['pane', 'layout']);
  const layoutPanes =
    (layoutData && layoutData.result && layoutData.result.layout && layoutData.result.layout.panes) || [];
  const tarLayout = layoutPanes.find((p) => p.pane_id === targetId);

  if (neighbors.length > 0) {
    const neighbor = neighbors[0];
    const neighborLayout = layoutPanes.find((p) => p.pane_id === neighbor.pane_id);

    let dirToTarget = 'right';
    let dirToNeighbor = 'left';
    if (tarLayout && neighborLayout && tarLayout.rect && neighborLayout.rect) {
      if (tarLayout.rect.x > neighborLayout.rect.x) {
        dirToTarget = 'right';
        dirToNeighbor = 'left';
      } else if (tarLayout.rect.x < neighborLayout.rect.x) {
        dirToTarget = 'left';
        dirToNeighbor = 'right';
      } else if (tarLayout.rect.y > neighborLayout.rect.y) {
        dirToTarget = 'down';
        dirToNeighbor = 'up';
      } else {
        dirToTarget = 'up';
        dirToNeighbor = 'down';
      }
    }

    // Force directional focus transition via --pane
    // Cycling away to neighbor and back ensures ConPTY fires the focus-in event to render the block cursor.
    runHerdr(['pane', 'focus', '--pane', targetId, '--direction', dirToNeighbor]);
    runHerdr(['pane', 'focus', '--pane', neighbor.pane_id, '--direction', dirToTarget]);
    return;
  }

  runHerdr(['agent', 'focus', targetId]);
}

async function ensureInputFocused(targetPane) {
  // 1. Initial directional pane focus cycle to trigger ConPTY/OpenTUI focus event
  focusPane(targetPane);

  // 2. Poll up to 3 seconds for cursor to appear in composer
  for (let attempt = 0; attempt < 12; attempt++) {
    await sleep(250);

    const res = runHerdr(['pane', 'read', targetPane, '--lines', '15']);
    const stdout = (res.status === 0 && res.stdout) || '';

    // If modal/help is open, dismiss it
    if (/Close help/i.test(stdout)) {
      runHerdr(['pane', 'send-keys', targetPane, 'escape']);
      await sleep(150);
      continue;
    }

    // Check if cursor glyph is active in composer
    if (stdout.includes('\u258d') || stdout.includes('▍') || stdout.includes('▎')) {
      return true;
    }

    // Periodically re-nudge focus if not yet acquired
    if (attempt === 2 || attempt === 5 || attempt === 8) {
      focusPane(targetPane);
    }
  }

  return false;
}

async function main() {
  const rawArgs = process.argv.slice(2);
  let shouldWait = false;
  const filteredArgs = [];

  for (const a of rawArgs) {
    if (a === '--wait') {
      shouldWait = true;
    } else {
      filteredArgs.push(a);
    }
  }

  if (filteredArgs.length === 0) {
    console.error('Usage: node prompt.js [TargetPane] <Prompt> [--wait]');
    process.exit(1);
  }

  let targetPane = null;
  let promptText = '';

  const paneIdRegex = /^w\d+:p[0-9a-fA-F]+$/;

  if (filteredArgs.length >= 2) {
    if (paneIdRegex.test(filteredArgs[0])) {
      targetPane = filteredArgs[0];
      promptText = filteredArgs.slice(1).join(' ');
    } else {
      const panesData = getJson(['pane', 'list']);
      const panes = (panesData && panesData.result && panesData.result.panes) || [];
      const matched = panes.find((p) => p.pane_id === filteredArgs[0]);
      if (matched) {
        targetPane = matched.pane_id;
        promptText = filteredArgs.slice(1).join(' ');
      } else {
        promptText = filteredArgs.join(' ');
      }
    }
  } else {
    promptText = filteredArgs[0];
  }

  // Fetch live panes and agents
  const panesData = getJson(['pane', 'list']);
  const panes = (panesData && panesData.result && panesData.result.panes) || [];

  const agentsData = getJson(['agent', 'list']);
  const agents = (agentsData && agentsData.result && agentsData.result.agents) || [];

  // Identify caller pane (currently focused)
  let callerPaneId = null;
  const focusedPane = panes.find((p) => p.focused);
  if (focusedPane) {
    callerPaneId = focusedPane.pane_id;
  }

  // Auto-detect targetPane if not yet identified
  if (!targetPane) {
    const fbPane = panes.find(
      (p) =>
        p.agent === 'freebuff' ||
        p.display_agent === 'freebuff' ||
        (p.terminal_title && /freebuff/i.test(p.terminal_title))
    );
    if (fbPane) {
      targetPane = fbPane.pane_id;
    } else {
      const fbAgent = agents.find(
        (a) =>
          a.agent === 'freebuff' ||
          a.name === 'freebuff' ||
          (a.terminal_title && /freebuff/i.test(a.terminal_title))
      );
      if (fbAgent) {
        targetPane = fbAgent.pane_id;
      }
    }
  }

  if (!targetPane) {
    console.error('Error: No active Freebuff pane found in Herdr. Start Freebuff in a pane first.');
    process.exit(1);
  }

  // 1. Ensure Freebuff pane is focused AND composer input has the cursor
  const hasCursor = await ensureInputFocused(targetPane);
  if (!hasCursor) {
    console.warn(`Warning: Composer cursor not detected in pane '${targetPane}', proceeding with simulated input...`);
  }

  // 2. Deliver prompt text to target pane via `pane run` (types characters directly into ConPTY)
  const sendRes = runHerdr(['pane', 'run', targetPane, promptText]);
  if (sendRes.status !== 0) {
    console.error(`Failed to send prompt text to pane ${targetPane}:`, sendRes.stderr);
    process.exit(1);
  }

  // 3. Wait for ConPTY input stream and OpenTUI composer to absorb characters.
  //    A multi-KB paste can take tens of seconds to absorb; Enter sent before then is
  //    swallowed by an empty composer and the prompt is silently never submitted.
  //    The old flat 2.5s cap applied equally to a 100-char and a 4,200-char paste.
  const settleMs = Math.min(20000, Math.max(800, promptText.length * 12));
  await sleep(settleMs);

  // 4. Submit, and verify the turn actually started.
  //
  //    Enter can be swallowed by three independent things:
  //      (a) the composer never took focus          -> re-focus before retrying
  //      (b) the wallet-credit confirmation modal    -> it consumes one Enter,
  //                                                      so submission needs another
  //      (c) the TUI is still absorbing a large paste -> keep retrying
  //
  //    "Add to the current task" is NOT a success signal. It is the placeholder of an
  //    EMPTY composer, and it is equally visible while a large paste sits unsubmitted --
  //    treating it as success is what made this script report "delivered" on a prompt
  //    that never ran.
  //
  //    Submission is proven by ANY of:
  //      - status reaches working/blocked (the normal case), OR
  //      - the pane's state_change_seq advances (a turn too fast to observe still counts), OR
  //      - the sent-prompt attachment card appears in the transcript above the composer.
  //    The seq check is load-bearing: Freebuff answers a trivial prompt in ~1s, so a poll
  //    slower than the turn reads idle both for a real turn and for a turn that never ran.
  const before = getPaneState(targetPane);
  const baseSeq = before ? before.seq : null;
    let submitted = false;
  let lastState = before;
  let usedFallback = false;

  for (let attempt = 0; attempt < 12; attempt++) {
    if (lastState) {
      if (isActiveStatus(lastState.status)) { submitted = true; break; }
      if (baseSeq !== null && lastState.seq !== null && lastState.seq > baseSeq) {
        submitted = true; break;
      }
    }
    // Re-focus on every other attempt: an unfocused pane drops keystrokes via ConPTY,
    // so Enter alone is not enough to recover from (a).
    if (attempt % 2 === 0) focusPane(targetPane);
    runHerdr(['pane', 'send-keys', targetPane, 'enter']);
    await sleep(350);
    lastState = getPaneState(targetPane);

    // A turn short enough to finish between polls never shows as 'working', so also
    // check the transcript. Matching this prompt's exact char count keeps it from
    // matching an earlier turn's answer.
    if (attempt >= 1 && screenShowsAnsweredTurn(targetPane, promptText)) {
      submitted = true;
      usedFallback = true;
      break;
    }
  }

  if (!submitted && lastState) {
    if (isActiveStatus(lastState.status)) submitted = true;
    else if (baseSeq !== null && lastState.seq !== null && lastState.seq > baseSeq) submitted = true;
    else if (screenShowsAnsweredTurn(targetPane, promptText)) {
      submitted = true;
      usedFallback = true;
    }
  }

  if (usedFallback) {
  console.warn(
      `Note: the turn on pane '${targetPane}' completed between polls, so delivery was ` +
        `confirmed from the transcript rather than by observing 'working'.` +
        (baseSeq === null
          ? ` Herdr does not expose state_change_seq for Freebuff panes, so that field ` +
            `cannot be used as a fallback signal here.`
          : '')
    );
  }

  // Always hand focus back, whether or not --wait was requested. Leaving the caller's
  // pane unfocused was a side effect of the old --wait-only restore.
  const restoreFocus = () => {
    if (callerPaneId && callerPaneId !== targetPane) focusPane(callerPaneId);
  };

  if (!submitted) {
    restoreFocus();
    console.error(
      `Error: pane '${targetPane}' still idle with state_change_seq ${baseSeq} after 12 Enter attempts, so the ` +
        `prompt was NOT submitted. It is most likely sitting unsubmitted in the composer. ` +
        `Focus the pane manually and press Enter, then re-run.`
    );
    process.exit(2);
  }

  console.log(`Prompt delivered to Freebuff pane '${targetPane}'.`);

  // 5. Optional wait
  if (shouldWait) {
    console.log(`Waiting for Freebuff turn completion on pane '${targetPane}'...`);
    
    // Step 1: Wait up to 10s for Freebuff to enter 'working'
    const startWait = Date.now();
    let enteredWorking = false;
    while (Date.now() - startWait < 10000) {
      const pData = getJson(['pane', 'list']);
      const cur = (pData && pData.result && pData.result.panes || []).find(p => p.pane_id === targetPane);
      if (cur && (cur.agent_status === 'working' || cur.agent_status === 'blocked')) {
        enteredWorking = true;
        break;
      }
      await sleep(300);
    }

    if (!enteredWorking) {
      console.warn(`Warning: Freebuff did not report 'working' state within 10s on pane '${targetPane}'.`);
    }

    // Step 2: Wait until it returns to idle or done
    const waitRes = runHerdr(['agent', 'wait', targetPane, '--until', 'idle', '--until', 'done', '--timeout', '300000']);
    if (waitRes.status === 0) {
      console.log(`Freebuff turn completed on pane '${targetPane}'.`);
    } else {
      console.log(`Wait ended (status: ${waitRes.status}).`);
    }
  }

  // Restore the caller's focus on every path, not only when --wait was requested.
  // Stealing focus and never giving it back was a side effect of the old restore.
  restoreFocus();
}

main().catch((err) => {
  console.error('prompt.js error:', err);
  process.exit(1);
});
