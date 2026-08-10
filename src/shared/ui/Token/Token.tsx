import { Token as AstryxToken } from '@astryxdesign/core/Token';
import type { TokenProps as AstryxTokenProps, TokenColor, TokenSize } from '@astryxdesign/core/Token';

export type TokenProps = AstryxTokenProps;
export type { TokenColor, TokenSize };

/**
 * LunaClair Token — thin adapter over @astryxdesign/core Token.
 */
export function Token(props: TokenProps) {
  return <AstryxToken {...props} />;
}

Token.displayName = 'Token';
