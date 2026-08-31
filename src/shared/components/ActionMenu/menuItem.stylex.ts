import * as stylex from '@stylexjs/stylex';

/** Reusable StyleX styles for Astryx DropdownMenuItem consumers. */
export const menuItemStyles = stylex.create({
  item: {
    borderRadius: 6,
    transition: 'background-color 0.12s ease',
    ':hover': {
      backgroundColor: 'rgba(0, 0, 0, 0.10)',
    },
    ':focus': {
      backgroundColor: 'rgba(0, 0, 0, 0.10)',
    },
  },
});
