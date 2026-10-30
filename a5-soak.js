import { journey } from './journey.js';

// Scaled-down soak: 2 users for 10 minutes (a real soak runs for hours).
export const options = {
  stages: [
    { duration: '30s', target: 2 },
    { duration: '10m', target: 2 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    checks: ['rate>0.99'],
    http_req_failed: ['rate<0.01'],
    'http_req_duration{group:::home}': ['p(95)<1000'],
    'http_req_duration{group:::recommendation}': ['p(95)<1500'],
  },
};

export default function () {
  journey();
}
