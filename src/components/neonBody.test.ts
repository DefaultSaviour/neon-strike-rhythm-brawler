import { describe, expect, it } from 'vitest';
import { bodyFill, farColor, mixHex } from './neonBody';

describe('mixHex', () => {
  it('returns the ends at t = 0 and t = 1', () => {
    expect(mixHex('#ff0000', '#0000ff', 0)).toBe('#ff0000');
    expect(mixHex('#ff0000', '#0000ff', 1)).toBe('#0000ff');
  });

  it('blends halfway', () => {
    expect(mixHex('#000000', '#ffffff', 0.5)).toBe('#808080');
  });

  it('clamps t and leaves invalid colours alone', () => {
    expect(mixHex('#000000', '#ffffff', 2)).toBe('#ffffff');
    expect(mixHex('red', '#ffffff', 0.5)).toBe('red');
  });
});

describe('body colours', () => {
  const brightness = (hex: string) =>
    parseInt(hex.slice(1, 3), 16) + parseInt(hex.slice(3, 5), 16) + parseInt(hex.slice(5, 7), 16);

  it('fills bodies with a dark tint of the character colour', () => {
    const fill = bodyFill('#ff1744');
    expect(brightness(fill)).toBeLessThan(brightness('#ff1744') * 0.3);
    // Still leans toward the character's colour (red channel highest)
    expect(parseInt(fill.slice(1, 3), 16)).toBeGreaterThan(parseInt(fill.slice(3, 5), 16));
  });

  it('draws far-side limbs dimmer than near-side limbs', () => {
    expect(brightness(farColor('#00f3ff'))).toBeLessThan(brightness('#00f3ff'));
  });
});
