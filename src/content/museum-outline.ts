import { museumExhibits } from './museum';
export { museumSections } from './museum';
// The landing page uses the same content as the full exhibit; an outline is not a visit.
export const museumOutline=museumExhibits.map(({id,section,title,question})=>({id,section,title,question}));
