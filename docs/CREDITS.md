# Credits and third-party assets

Everything here is free to use in this game. Licences are kept with the project.

| Asset | Where it is | Author | Licence | Source |
|---|---|---|---|---|
| Race car model (`RaceCar.glb`) | `public/models/race-car.glb` | mabaci | CC0 1.0 Universal (public domain) | [OpenGameArt: Free, Low Poly 3D Race car model](https://opengameart.org/content/free-low-poly-3d-race-car-model-%F0%9F%8F%8D%EF%B8%8F%F0%9F%8F%81%F0%9F%9A%A6%F0%9F%8F%86) |
| Barlow and Barlow Condensed fonts | bundled from `@fontsource/barlow`, `@fontsource/barlow-condensed` | Jeremy Tribby | SIL Open Font License 1.1 | npm `@fontsource` packages |
| three.js | npm `three` | three.js authors | MIT | npm |

## Race car model notes
- Downloaded 2026-11-15 as `racecar.zip` (574 KB) with the owner's approval. The zip's own licence file reads: "This 3D model is released under the CC0 1.0 Universal (CC0 1.0) Public Domain Dedication … You are not required to give credit to the author." Credit is given here anyway.
- Only the `.glb` from the zip is used. In the game it is turned to face forward, scaled to 4.6 m, and recoloured per team at load (`src/render/GltfRaceCar.ts`).
