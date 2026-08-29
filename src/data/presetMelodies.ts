import { PresetMelody } from '../types';

export const presetMelodies: PresetMelody[] = [
  {
    id: 'westminster',
    name: 'Westminster Quarters',
    nameRu: 'Вестминстерский перезвон',
    category: 'classic',
    description: 'Классический британский часовой перезвон Биг-Бена (E-G#-F#-B -> E-F#-G#-E)',
    duration: 3.2,
    notes: [
      { freq: 659.25, duration: 0.5, delay: 0.0, type: 'sine', gain: 0.9 }, // E5
      { freq: 830.61, duration: 0.5, delay: 0.5, type: 'sine', gain: 0.9 }, // G#5
      { freq: 739.99, duration: 0.5, delay: 1.0, type: 'sine', gain: 0.9 }, // F#5
      { freq: 493.88, duration: 0.9, delay: 1.5, type: 'sine', gain: 1.0 }, // B4
      
      { freq: 659.25, duration: 0.5, delay: 2.3, type: 'sine', gain: 0.85 }, // E5
      { freq: 739.99, duration: 0.5, delay: 2.7, type: 'sine', gain: 0.85 }, // F#5
      { freq: 830.61, duration: 0.5, delay: 3.1, type: 'sine', gain: 0.85 }, // G#5
      { freq: 659.25, duration: 1.1, delay: 3.5, type: 'sine', gain: 0.95 }, // E5
    ],
  },
  {
    id: 'tubular-dingdong',
    name: 'Tubular Ding-Dong',
    nameRu: 'Двухтональный трубный звон',
    category: 'classic',
    description: 'Глубокий двухтональный звон с богатыми гармониками и мягким затуханием',
    duration: 2.6,
    notes: [
      { freq: 587.33, duration: 1.3, delay: 0.0, type: 'triangle', gain: 1.0 }, // D5
      { freq: 440.00, duration: 1.8, delay: 0.6, type: 'triangle', gain: 1.0 }, // A4
    ],
  },
  {
    id: 'modern-chime',
    name: 'Modern Pentatonic',
    nameRu: 'Современный пентатонический перелив',
    category: 'modern',
    description: 'Быстрый мягкий перезвон с нео-акустическим тембром',
    duration: 2.2,
    notes: [
      { freq: 523.25, duration: 0.35, delay: 0.0, type: 'sine', gain: 0.8 }, // C5
      { freq: 659.25, duration: 0.35, delay: 0.2, type: 'sine', gain: 0.8 }, // E5
      { freq: 783.99, duration: 0.4, delay: 0.4, type: 'sine', gain: 0.85 }, // G5
      { freq: 987.77, duration: 0.4, delay: 0.6, type: 'sine', gain: 0.9 }, // B5
      { freq: 1046.50, duration: 1.2, delay: 0.85, type: 'sine', gain: 0.95 }, // C6
    ],
  },
  {
    id: 'marimba-welcome',
    name: 'Marimba Warm Greeting',
    nameRu: 'Теплая маримба',
    category: 'modern',
    description: 'Уютные деревянные перкуссионные ноты для теплого домашнего приема',
    duration: 2.4,
    notes: [
      { freq: 440.00, duration: 0.3, delay: 0.0, type: 'triangle', gain: 0.8 }, // A4
      { freq: 554.37, duration: 0.3, delay: 0.18, type: 'triangle', gain: 0.85 }, // C#5
      { freq: 659.25, duration: 0.3, delay: 0.36, type: 'triangle', gain: 0.9 }, // E5
      { freq: 880.00, duration: 1.1, delay: 0.58, type: 'triangle', gain: 0.95 }, // A5
    ],
  },
  {
    id: 'cyber-synth',
    name: 'Cybernetic High-Tech',
    nameRu: 'Кибернетический хай-тек',
    category: 'retro',
    description: 'Футуристический электронный сигнал для умного дома будущего',
    duration: 1.8,
    notes: [
      { freq: 880.00, duration: 0.15, delay: 0.0, type: 'sawtooth', gain: 0.5 },
      { freq: 1174.66, duration: 0.15, delay: 0.12, type: 'sawtooth', gain: 0.55 },
      { freq: 1760.00, duration: 0.7, delay: 0.25, type: 'sawtooth', gain: 0.6 },
    ],
  },
  {
    id: 'holiday-jingle',
    name: 'Holiday Jingle',
    nameRu: 'Праздничный перезвон',
    category: 'festive',
    description: 'Веселый перезвон колокольчиков для создания праздничного настроения',
    duration: 2.8,
    notes: [
      { freq: 659.25, duration: 0.25, delay: 0.0, type: 'sine', gain: 0.8 }, // E5
      { freq: 659.25, duration: 0.25, delay: 0.25, type: 'sine', gain: 0.8 }, // E5
      { freq: 659.25, duration: 0.45, delay: 0.5, type: 'sine', gain: 0.9 }, // E5
      { freq: 659.25, duration: 0.25, delay: 0.9, type: 'sine', gain: 0.8 }, // E5
      { freq: 659.25, duration: 0.25, delay: 1.15, type: 'sine', gain: 0.8 }, // E5
      { freq: 659.25, duration: 0.45, delay: 1.4, type: 'sine', gain: 0.9 }, // E5
      { freq: 659.25, duration: 0.25, delay: 1.8, type: 'sine', gain: 0.85 }, // E5
      { freq: 783.99, duration: 0.25, delay: 2.05, type: 'sine', gain: 0.9 }, // G5
      { freq: 523.25, duration: 0.3, delay: 2.3, type: 'sine', gain: 0.9 }, // C5
      { freq: 587.33, duration: 0.3, delay: 2.55, type: 'sine', gain: 0.9 }, // D5
      { freq: 659.25, duration: 0.9, delay: 2.8, type: 'sine', gain: 1.0 }, // E5
    ],
  },
  {
    id: 'birdsong',
    name: 'Morning Forest Chime',
    nameRu: 'Утренняя птичья трель',
    category: 'nature',
    description: 'Природный мелодичный перелив со свипом частот, напоминающий пение лесных птиц',
    duration: 2.5,
    notes: [
      { freq: 1200, duration: 0.2, delay: 0.0, type: 'sine', gain: 0.6 },
      { freq: 1600, duration: 0.25, delay: 0.15, type: 'sine', gain: 0.7 },
      { freq: 1400, duration: 0.3, delay: 0.35, type: 'sine', gain: 0.65 },
      { freq: 1900, duration: 0.5, delay: 0.6, type: 'sine', gain: 0.8 },
      { freq: 1300, duration: 0.3, delay: 1.1, type: 'sine', gain: 0.6 },
      { freq: 1800, duration: 0.6, delay: 1.35, type: 'sine', gain: 0.75 },
    ],
  },
  {
    id: 'vintage-hotel-gong',
    name: 'Vintage Reception Gong',
    nameRu: 'Винтажный бронзовый гонг',
    category: 'retro',
    description: 'Одиночный глубокий удар по латунному гонгу с продолжительным сустейном',
    duration: 3.5,
    notes: [
      { freq: 330.0, duration: 3.2, delay: 0.0, type: 'triangle', gain: 1.0 },
      { freq: 660.0, duration: 2.0, delay: 0.0, type: 'sine', gain: 0.6 },
      { freq: 990.0, duration: 1.2, delay: 0.0, type: 'sine', gain: 0.3 },
    ],
  },
];
