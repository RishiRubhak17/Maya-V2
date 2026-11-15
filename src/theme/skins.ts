export interface ThemeSkin {
  id: 'ash' | 'stark';
  name: string;
  description: string;
  baseAccent: string;
  coreGlowColor: string;
  coreCenterColor: string;
  ring1Opacity: number;
  ring2SpeedMultiplier: number;
  ring3Opacity: number;
  haloColor: string;
}

export const THEME_SKINS: Record<'ash' | 'stark', ThemeSkin> = {
  ash: {
    id: 'ash',
    name: 'Ash & Bone-White (Default)',
    description: 'Subtle tactical ash with emotion-tinted accents. Zero blue/cyan.',
    baseAccent: '#d6d3cc',
    coreGlowColor: 'rgba(214, 211, 204, 0.4)',
    coreCenterColor: '#f4f2ec',
    ring1Opacity: 0.55,
    ring2SpeedMultiplier: 1.0,
    ring3Opacity: 0.5,
    haloColor: 'rgba(0, 0, 0, 0.65)',
  },
  stark: {
    id: 'stark',
    name: 'Stark Arc Reactor',
    description: 'Tony Stark gold and metallic crimson arc reactor core.',
    baseAccent: '#f5b041',
    coreGlowColor: 'rgba(245, 176, 65, 0.55)',
    coreCenterColor: '#fff9e6',
    ring1Opacity: 0.75,
    ring2SpeedMultiplier: 1.25,
    ring3Opacity: 0.7,
    haloColor: 'rgba(20, 5, 5, 0.75)',
  },
};
