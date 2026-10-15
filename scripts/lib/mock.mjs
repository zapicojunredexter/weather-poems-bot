// Mock Data Mode: a hardcoded weather object and pre-written placeholder poems for UI work.
// Makes ZERO network requests. Mock entries are clearly labelled "mock" on the page and are
// NOT AI-generated; they exist only so you can test the layout locally.
import { describeCode } from './weather.mjs';

export function mockWeather(location) {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: location.timezone ?? 'Asia/Manila' }).format(new Date());
  return {
    date: today,
    code: 2,
    ...describeCode(2),
    description: 'partly cloudy',
    tempNow: 31.4,
    tempMax: 33.8,
    tempMin: 26.1,
    humidity: 72,
    windMax: 14.2,
    rainChance: 40,
    rainMm: 0.6,
    uvMax: 9.1,
    sunrise: '05:47',
    sunset: '17:36',
  };
}

// Original poems written for this project. Rotated so the timeline shows some variety.
const MOCK_POEMS = [
  {
    title: 'Half-Clouded Morning',
    lines: [
      'the sky cannot decide today',
      'so it keeps a little of both,',
      'a blue window here,',
      'a soft grey curtain there.',
      'heat settles on the rooftops',
      'like a cat that will not move,',
      'and somewhere a breeze',
      'remembers it was promised rain.',
    ],
  },
  {
    title: 'Before the Shower',
    lines: [
      'the air grows heavy and patient,',
      'leaves turn their pale sides up,',
      'a sparrow hurries home',
      'with the news before anyone else.',
      'the street smells of warm stone',
      'and the first cool hint of water.',
    ],
  },
  {
    title: 'Slow Afternoon',
    lines: [
      'noon pours its gold over the city,',
      'shadows shrink beneath the trees,',
      'a kite of cloud drifts west',
      'without a string to hold it.',
      'by sunset the heat lets go,',
      'and the evening hums',
      'a quieter, gentler song.',
    ],
  },
];

export function mockPoem(index = 0) {
  const poem = MOCK_POEMS[index % MOCK_POEMS.length];
  return { title: poem.title, lines: [...poem.lines] };
}

export const MOCK_POEM_COUNT = MOCK_POEMS.length;
