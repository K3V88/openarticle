import { analyze, extract } from './article';
(globalThis as typeof globalThis & { openArticle?:unknown }).openArticle={analyze:()=>analyze(document),extract:()=>extract(document)};
