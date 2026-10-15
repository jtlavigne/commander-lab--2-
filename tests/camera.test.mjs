import {test} from 'node:test';
import assert from 'node:assert/strict';
import {TABLE,seatBounds,zoomAt,constrainView,frameRect,workingView,availableViewSize} from '../camera.mjs';

test('zoom preserves the world point under the pointer',()=>{
 const before={x:-500,y:-300,scale:.8},pointer={x:420,y:260};
 const after=zoomAt(before,1.3,pointer);
 assert.ok(Math.abs((pointer.x-before.x)/before.scale-(pointer.x-after.x)/after.scale)<1e-9);
 assert.ok(Math.abs((pointer.y-before.y)/before.scale-(pointer.y-after.y)/after.scale)<1e-9);
});
test('seat views frame the entire playmat in the available space',()=>{
 const size={width:1450,height:700};
 assert.ok(seatBounds(0).x<seatBounds(1).x);assert.ok(seatBounds(3).y>seatBounds(0).y);assert.equal(seatBounds(2).x,seatBounds(1).x);
 for(let seat=0;seat<4;seat++){
  const rect=seatBounds(seat),view=frameRect(rect,size);
  assert.ok(rect.x*view.scale+view.x>=0);assert.ok(rect.y*view.scale+view.y>=0);
  assert.ok((rect.x+rect.width)*view.scale+view.x<=size.width);assert.ok((rect.y+rect.height)*view.scale+view.y<=size.height);
  const working=constrainView(workingView(seat,size),size);assert.ok(rect.x*working.scale+working.x>=0);assert.ok(rect.y*working.scale+working.y>=0);
  assert.ok((rect.x+rect.width)*working.scale+working.x<=size.width);assert.ok((rect.y+rect.height)*working.scale+working.y<=size.height);
 }
});
test('framing reserves the dock footprint with a gap for every seat',()=>{
 const viewport={top:215,width:1476,height:703},dock={top:808};const size=availableViewSize(viewport,dock);
 assert.deepEqual(size,{width:1476,height:581});
 for(let seat=0;seat<4;seat++){const rect=seatBounds(seat),view=constrainView(workingView(seat,size),size);assert.ok((rect.y+rect.height)*view.scale+view.y<=size.height);}
 assert.equal(availableViewSize(viewport,{top:700}).height,473);assert.equal(availableViewSize(viewport).height,703);
});
test('camera bounds prevent losing the table; whole-table framing fits a small screen',()=>{
 const size={width:950,height:490},rect={x:0,y:0,width:TABLE.width,height:TABLE.height};
 const fit=constrainView(frameRect(rect,size),size);assert.ok(fit.x>=0&&fit.y>=0);assert.ok(fit.x+TABLE.width*fit.scale<=size.width);assert.ok(fit.y+TABLE.height*fit.scale<=size.height);
 const view=constrainView({x:99999,y:-99999,scale:1},size);assert.equal(view.x,64);assert.equal(view.y,size.height-TABLE.height-64);
});
test('expanded playmats and the whole table still fit above a tall dock',()=>{
 assert.equal(TABLE.matWidth*TABLE.matHeight,3000*1800);
 const size={width:950,height:190},rect={x:0,y:0,width:TABLE.width,height:TABLE.height};
 const view=constrainView(frameRect(rect,size),size);assert.ok(view.x>=0&&view.y>=0);assert.ok(view.x+TABLE.width*view.scale<=size.width);assert.ok(view.y+TABLE.height*view.scale<=size.height);
});
