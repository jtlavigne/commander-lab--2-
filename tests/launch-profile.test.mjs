import {test} from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import profiles from '../launch-profile.cjs';
const {launchProfile}=profiles;
test('normal startup keeps the existing desktop profile; named clients have independent paths',()=>{
 const root=path.resolve('desktop-profile');
 assert.equal(launchProfile(['.'],root),null);
 assert.deepEqual(launchProfile(['.','--profile=Player2'],root),{name:'player2',directory:path.join(root,'profiles','player2')});
 assert.notEqual(launchProfile(['--profile=player2'],root).directory,launchProfile(['--profile=player3'],root).directory);
});
test('profile names cannot escape the profile directory or ambiguously select directories',()=>{
 for(const args of [['--profile'],['--profile='],['--profile=../other'],['--profile=C:\\other'],['--profile=a/b'],['--profile=a','--profile=b'],['--profile='+'x'.repeat(33)]])assert.throws(()=>launchProfile(args,'root'),/--profile=NAME/);
});
