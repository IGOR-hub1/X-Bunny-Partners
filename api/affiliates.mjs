import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {createHandler}=require('../../x-bunny-shared/affiliate-handler.js');
export default createHandler('partners');
