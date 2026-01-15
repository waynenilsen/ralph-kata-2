import { describe, expect, mock, test } from 'bun:test';
import { ColorPicker, PRESET_COLORS } from './color-picker';

describe('PRESET_COLORS', () => {
  test('contains 8 colors', () => {
    expect(PRESET_COLORS).toHaveLength(8);
  });

  test('contains the required preset colors', () => {
    const values = PRESET_COLORS.map((c) => c.value);
    expect(values).toContain('#ef4444'); // Red
    expect(values).toContain('#f97316'); // Orange
    expect(values).toContain('#eab308'); // Yellow
    expect(values).toContain('#22c55e'); // Green
    expect(values).toContain('#3b82f6'); // Blue
    expect(values).toContain('#a855f7'); // Purple
    expect(values).toContain('#ec4899'); // Pink
    expect(values).toContain('#6b7280'); // Gray
  });

  test('each color has a name and value', () => {
    for (const color of PRESET_COLORS) {
      expect(color.name).toBeDefined();
      expect(color.value).toBeDefined();
      expect(color.name.length).toBeGreaterThan(0);
      expect(color.value).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });
});

describe('ColorPicker', () => {
  test('renders 8 color buttons', () => {
    const onChange = mock(() => {});
    const result = ColorPicker({ value: '#ef4444', onChange });

    const container = result?.props?.children;
    expect(container).toHaveLength(8);
  });

  test('each button has correct background color', () => {
    const onChange = mock(() => {});
    const result = ColorPicker({ value: '#ef4444', onChange });

    const buttons = result?.props?.children;
    for (let i = 0; i < PRESET_COLORS.length; i++) {
      expect(buttons[i]?.props?.style?.backgroundColor).toBe(
        PRESET_COLORS[i].value,
      );
    }
  });

  test('selected color has different border styling', () => {
    const onChange = mock(() => {});
    const result = ColorPicker({ value: '#3b82f6', onChange });

    const buttons = result?.props?.children;
    // Find the blue button (index 4)
    const blueIndex = PRESET_COLORS.findIndex((c) => c.value === '#3b82f6');
    const selectedButton = buttons[blueIndex];
    expect(selectedButton?.props?.className).toContain('border-foreground');
    expect(selectedButton?.props?.className).toContain('scale-110');
  });

  test('unselected color does not have selected styling', () => {
    const onChange = mock(() => {});
    const result = ColorPicker({ value: '#3b82f6', onChange });

    const buttons = result?.props?.children;
    // Find the red button (index 0) which is not selected
    const redIndex = PRESET_COLORS.findIndex((c) => c.value === '#ef4444');
    const unselectedButton = buttons[redIndex];
    expect(unselectedButton?.props?.className).toContain('border-transparent');
    expect(unselectedButton?.props?.className).not.toContain('scale-110');
  });

  test('buttons have title attribute with color name', () => {
    const onChange = mock(() => {});
    const result = ColorPicker({ value: '#ef4444', onChange });

    const buttons = result?.props?.children;
    for (let i = 0; i < PRESET_COLORS.length; i++) {
      expect(buttons[i]?.props?.title).toBe(PRESET_COLORS[i].name);
    }
  });

  test('buttons are type="button"', () => {
    const onChange = mock(() => {});
    const result = ColorPicker({ value: '#ef4444', onChange });

    const buttons = result?.props?.children;
    for (const button of buttons) {
      expect(button?.props?.type).toBe('button');
    }
  });

  test('buttons are rounded-full', () => {
    const onChange = mock(() => {});
    const result = ColorPicker({ value: '#ef4444', onChange });

    const buttons = result?.props?.children;
    for (const button of buttons) {
      expect(button?.props?.className).toContain('rounded-full');
    }
  });

  test('container uses flex-wrap gap-2', () => {
    const onChange = mock(() => {});
    const result = ColorPicker({ value: '#ef4444', onChange });

    expect(result?.props?.className).toContain('flex');
    expect(result?.props?.className).toContain('flex-wrap');
    expect(result?.props?.className).toContain('gap-2');
  });
});
