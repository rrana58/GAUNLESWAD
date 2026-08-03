/**
 * Gharko Swaad Design Tokens Central Export
 */

import { colors } from './colors.js';
import { spacing } from './spacing.js';
import { typography } from './typography.js';
import { shadows } from './shadows.js';
import { radius } from './radius.js';
import { motion } from './motion.js';
import { breakpoints } from './breakpoints.js';

export {
  colors,
  spacing,
  typography,
  shadows,
  radius,
  motion,
  breakpoints,
};

export { ThemeProvider, useTheme } from './ThemeProvider.jsx';

export const theme = {
  colors,
  spacing,
  typography,
  shadows,
  radius,
  motion,
  breakpoints,
};

export default theme;
