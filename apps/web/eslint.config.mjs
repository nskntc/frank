import nextVitals from 'eslint-config-next/core-web-vitals';
import base from '../../eslint.config.mjs';

export default [...base, ...nextVitals, { ignores: ['.next/**', 'next-env.d.ts'] }];
