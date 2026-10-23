import { api } from './api.js';
export let eventId=sessionStorage.getItem('eventId')||'SAMPLE';
export function setEvent(id){eventId=id;sessionStorage.setItem('eventId',id);}
export function scoped(path){return api(path+(path.includes('?')?'&':'?')+'eventId='+encodeURIComponent(eventId));}
