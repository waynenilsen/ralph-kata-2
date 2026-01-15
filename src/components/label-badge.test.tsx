import { describe, expect, test } from 'bun:test';
import { getContrastColor, LabelBadge } from './label-badge';

describe('getContrastColor', () => {
  test('returns white for dark colors', () => {
    // Black - very dark
    expect(getContrastColor('#000000')).toBe('#ffffff');
    // Dark blue
    expect(getContrastColor('#1e3a5f')).toBe('#ffffff');
    // Dark purple
    expect(getContrastColor('#6b21a8')).toBe('#ffffff');
  });

  test('returns black for light colors', () => {
    // White - very light
    expect(getContrastColor('#ffffff')).toBe('#000000');
    // Light yellow
    expect(getContrastColor('#fef08a')).toBe('#000000');
    // Light gray
    expect(getContrastColor('#d1d5db')).toBe('#000000');
  });

  test('returns correct contrast for preset colors', () => {
    // Red (#ef4444) - luminance = (0.299*239 + 0.587*68 + 0.114*68)/255 ≈ 0.435 -> white
    expect(getContrastColor('#ef4444')).toBe('#ffffff');
    // Orange (#f97316) - luminance ≈ 0.509 -> black
    expect(getContrastColor('#f97316')).toBe('#000000');
    // Yellow (#eab308) - luminance ≈ 0.698 -> black
    expect(getContrastColor('#eab308')).toBe('#000000');
    // Green (#22c55e) - luminance ≈ 0.562 -> black
    expect(getContrastColor('#22c55e')).toBe('#000000');
    // Blue (#3b82f6) - luminance ≈ 0.413 -> white
    expect(getContrastColor('#3b82f6')).toBe('#ffffff');
    // Purple (#a855f7) - luminance ≈ 0.503 -> black (just over threshold)
    expect(getContrastColor('#a855f7')).toBe('#000000');
    // Pink (#ec4899) - luminance ≈ 0.511 -> black (just over threshold)
    expect(getContrastColor('#ec4899')).toBe('#000000');
    // Gray (#6b7280) - luminance ≈ 0.447 -> white
    expect(getContrastColor('#6b7280')).toBe('#ffffff');
  });
});

describe('LabelBadge', () => {
  test('renders label name', () => {
    const result = LabelBadge({ name: 'Bug', color: '#ef4444' });
    expect(result?.props?.children).toBe('Bug');
  });

  test('applies background color via style', () => {
    const result = LabelBadge({ name: 'Feature', color: '#22c55e' });
    expect(result?.props?.style?.backgroundColor).toBe('#22c55e');
  });

  test('applies correct text color via style', () => {
    // Dark background (blue) should have white text
    const darkResult = LabelBadge({ name: 'Test', color: '#3b82f6' });
    expect(darkResult?.props?.style?.color).toBe('#ffffff');

    // Light background (yellow) should have black text
    const lightResult = LabelBadge({ name: 'Test', color: '#eab308' });
    expect(lightResult?.props?.style?.color).toBe('#000000');
  });

  test('renders as a span element', () => {
    const result = LabelBadge({ name: 'Label', color: '#ef4444' });
    expect(result?.type).toBe('span');
  });

  test('applies custom className', () => {
    const result = LabelBadge({
      name: 'Label',
      color: '#ef4444',
      className: 'custom-class',
    });
    expect(result?.props?.className).toContain('custom-class');
  });

  test('has base styling classes', () => {
    const result = LabelBadge({ name: 'Label', color: '#ef4444' });
    const className = result?.props?.className;
    expect(className).toContain('inline-flex');
    expect(className).toContain('items-center');
    expect(className).toContain('rounded-full');
    expect(className).toContain('text-xs');
    expect(className).toContain('font-medium');
  });
});
