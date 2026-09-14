/**
 * List-rendering policy shared by every virtualized surface.
 *
 * Lists at or below this size render every node (pixel-identical to the
 * historic layout, zero virtualization overhead); larger lists switch to
 * window/container virtualization. The overview previews cap at 25 for the
 * same reason — full tabs only virtualize past it.
 */
export const VIRTUALIZE_AFTER_ITEM_COUNT = 25;
