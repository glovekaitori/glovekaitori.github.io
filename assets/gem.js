/* 主画面のダイヤモンド（ラウンドブリリアントカット57面）を実時間で描画する。
   無色透明の石を、反射・屈折・分光（虹色のファイア）で表現し、光点をきらめかせる。
   three.js が読めない・WebGL非対応のときは何もしない。動きを減らす設定では静止画1枚だけ描く。 */
(function(){
  var host=document.getElementById('gem');
  if(!host||!window.THREE) return;
  var reduce=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
  var T=window.THREE, W=host.clientWidth, H=host.clientHeight, renderer;
  try{renderer=new T.WebGLRenderer({antialias:true,alpha:true});}catch(e){return;}
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
  renderer.setSize(W,H);host.appendChild(renderer.domElement);host.classList.add('live');

  var scene=new T.Scene(), cam=new T.PerspectiveCamera(28,W/H,.1,100);
  cam.position.set(0,3.6,5.0);cam.lookAt(0,-.18,0);

  // ── 形状：理想的なプロポーション（テーブル56%・クラウン高15%・パビリオン深さ43%） ──
  var P=[], R=Math.PI/4;
  function v(r,a,y){return new T.Vector3(Math.cos(a)*r,y,Math.sin(a)*r);}
  var top=new T.Vector3(0,.30,0), culet=new T.Vector3(0,-.86,0);
  var Tb=[],S=[],G=[],Gl=[],L=[];
  for(var k=0;k<8;k++){
    Tb.push(v(.58,(k+.5)*R,.30));          // テーブルの角
    S.push(v(.78,(k+1)*R,.165));           // スターファセットの先端
    L.push(v(.22,k*R,-.69));               // ロワーガードルの先端
  }
  for(var j=0;j<16;j++){G.push(v(1,j*R/2,.012));Gl.push(v(1,j*R/2,-.012));}
  function tri(a,b,c){P.push(a.x,a.y,a.z,b.x,b.y,b.z,c.x,c.y,c.z);}
  function g(i){return G[(i+16)%16]} function gl(i){return Gl[(i+16)%16]}
  for(k=0;k<8;k++){
    var k1=(k+1)%8, k0=(k+7)%8;
    tri(top,Tb[k1],Tb[k]);                                   // テーブル
    tri(Tb[k],Tb[k1],S[k]);                                  // スター
    tri(Tb[k],S[k0],g(2*k+1)); tri(Tb[k],g(2*k+1),S[k]);     // ベゼル（凧形）
    tri(S[k],g(2*k+1),g(2*k+2)); tri(S[k],g(2*k+2),g(2*k+3));// アッパーガードル
    tri(gl(2*k-1),gl(2*k),L[k]); tri(gl(2*k),gl(2*k+1),L[k]);// ロワーガードル
    tri(gl(2*k+1),culet,L[k]); tri(gl(2*k+1),L[k1],culet);   // パビリオンメイン
  }
  for(j=0;j<16;j++){var a=g(j),b=g(j+1),c=gl(j+1),d=gl(j);tri(a,b,c);tri(a,c,d);} // ガードル
  var geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(P,3));geo.computeVertexNormals();

  // ── 光の計算：石に入った光が底面で全反射し、上面から分光して出る経路を面ごとに追う ──
  var uni={uTime:{value:0},uCamO:{value:new T.Vector3()},uRot:{value:new T.Matrix3()}};
  var mat=new T.ShaderMaterial({uniforms:uni,side:T.DoubleSide,
    vertexShader:[
      'varying vec3 vO; varying vec3 vNo;',
      'void main(){ vO=position; vNo=normal; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }'
    ].join('\n'),
    fragmentShader:[
      'uniform float uTime; uniform vec3 uCamO; uniform mat3 uRot; varying vec3 vO; varying vec3 vNo;',
      'const float PD=0.86; const float TAU=6.2831853;',
      'vec3 Ld(float i,float t){ float a=i*2.39996+t*0.32; float e=0.08+0.85*fract(i*0.618+0.1); return normalize(vec3(cos(a)*cos(e),sin(e),sin(a)*cos(e))); }',
      'vec3 env(vec3 dO){ vec3 d=normalize(uRot*dO);',
      '  vec3 c=vec3(0.03,0.03,0.035)+vec3(0.22,0.21,0.20)*pow(max(d.y,0.0),1.5);',
      '  for(int i=0;i<12;i++){ float fi=float(i); float s=max(dot(d,Ld(fi,uTime)),0.0);',
      '    vec3 col=(i==3||i==8)?vec3(1.0,0.88,0.66):vec3(1.0,0.99,0.97);',
      '    c+=col*(pow(s,70.0)*7.0+pow(s,10.0)*0.35); }',
      '  vec3 K=normalize(vec3(0.0,0.58,0.81));',
      '  float k0=max(dot(d,K),0.0); float ring=pow(max(sin(acos(min(k0,1.0))*22.0-uTime*0.6),0.0),4.0)*smoothstep(0.55,0.95,k0);',
      '  c+=vec3(1.0,0.99,0.97)*(pow(k0,5.0)*0.28+ring*1.3);',
      '  float th=acos(clamp(d.y,-1.0,1.0)); float zen=smoothstep(0.55,0.97,d.y);',
      '  float zr=pow(max(sin(th*26.0-uTime*0.7),0.0),5.0); float zs=pow(max(sin(atan(d.z,d.x)*8.0+uTime*0.25),0.0),8.0);',
      '  c+=vec3(1.0,0.99,0.96)*zen*(zr*1.6+zs*1.2);',
      '  float k1=max(dot(d,normalize(K+vec3(0.45,0.25,0.0))),0.0), k2=max(dot(d,normalize(K+vec3(-0.5,0.3,0.0))),0.0), k3=max(dot(d,vec3(0.0,1.0,0.0)),0.0);',
      '  c+=vec3(1.0,0.98,0.95)*(pow(k1,24.0)*2.2+pow(k1,4.0)*0.25)+vec3(1.0,0.97,0.92)*(pow(k2,24.0)*1.8+pow(k2,4.0)*0.2)+vec3(0.9,0.9,0.92)*pow(k3,6.0)*0.6;',
      '  float st=sin(d.x*40.0+uTime*0.5)*sin(d.z*40.0)*sin(d.y*30.0); c+=vec3(1.0)*pow(max(st,0.0),18.0)*1.6;',
      '  float az=atan(d.z,d.x); float band=pow(max(sin(az*7.0+uTime*0.35),0.0),6.0)*pow(max(sin(d.y*9.0+1.2),0.0),3.0)*smoothstep(0.05,0.6,d.y);',
      '  c+=vec3(1.0,0.99,0.96)*band*1.6;',
      '  return c; }',
      'bool hitPav(vec3 p,vec3 d,out vec3 h){',
      '  float k=1.0/PD; vec3 q=p; q.y+=PD;',
      '  float A=d.x*d.x+d.z*d.z-k*k*d.y*d.y; float B=2.0*(q.x*d.x+q.z*d.z-k*k*q.y*d.y); float C=q.x*q.x+q.z*q.z-k*k*q.y*q.y;',
      '  float D=B*B-4.0*A*C; if(D<0.0||abs(A)<1e-5) return false; float sq=sqrt(D);',
      '  float s1=(-B-sq)/(2.0*A), s2=(-B+sq)/(2.0*A); float s=1e9;',
      '  if(s1>1e-3){ float y=p.y+d.y*s1; if(y<0.0&&y>-PD) s=s1; }',
      '  if(s2>1e-3&&s2<s){ float y=p.y+d.y*s2; if(y<0.0&&y>-PD) s=s2; }',
      '  if(s>1e8) return false; h=p+d*s; return true; }',
      'vec3 facet(vec3 h,float n,float tilt,float up){ float a=atan(h.z,h.x); float st=TAU/n; a=(floor(a/st)+0.5)*st; return normalize(vec3(cos(a)*tilt,up,sin(a)*tilt)); }',
      'float trace(vec3 p,vec3 d,float ior,int ch){',
      '  float acc=0.0, w=1.0;',
      '  for(int i=0;i<5;i++){',
      '    vec3 h; if(!hitPav(p,d,h)) break;',
      '    float sec=(length(h.xz)>0.78)?32.0:16.0;',
      '    vec3 n=facet(h,sec,1.0,-1.0/PD);',
      '    vec3 rf=refract(d,n,ior);',
      '    if(dot(rf,rf)>0.0){ acc+=w*0.35*env(rf)[ch]; w*=0.72; }',
      '    d=reflect(d,n); p=h; }',
      '  float s=(0.30-p.y)/max(d.y,0.02); vec3 e=p+d*s; float r=length(e.xz);',
      '  vec3 n=(r<0.58)?vec3(0.0,1.0,0.0):facet(e,(r<0.78)?8.0:16.0,0.69,1.0);',
      '  vec3 o=refract(d,-n,ior);',
      '  if(dot(o,o)<1e-4) return acc+w*env(reflect(d,-n))[ch]*0.6;',
      '  return acc+w*env(o)[ch]; }',
      'void main(){',
      '  vec3 V=normalize(vO-uCamO); vec3 N=normalize(vNo); if(dot(V,N)>0.0) N=-N;',
      '  float cosi=clamp(dot(-V,N),0.0,1.0); float F=0.17+0.83*pow(1.0-cosi,5.0);',
      '  vec3 refl=env(reflect(V,N));',
      '  vec3 inner=vec3(trace(vO,refract(V,N,1.0/2.407),2.407,0), trace(vO,refract(V,N,1.0/2.424),2.424,1), trace(vO,refract(V,N,1.0/2.451),2.451,2));',
      '  vec3 col=mix(inner,refl,F);',
      '  col=1.0-exp(-col*1.6);',
      '  gl_FragColor=vec4(col,1.0); }'
    ].join('\n')});
  var gem=new T.Group();
  var mesh=new T.Mesh(geo,mat);gem.add(mesh);
  // 稜線：ごく淡い白で輪郭を立たせる
  gem.add(new T.LineSegments(new T.EdgesGeometry(geo,1),new T.LineBasicMaterial({color:0xffffff,transparent:true,opacity:.06})));
  gem.rotation.x=.30;gem.scale.setScalar(1.12);scene.add(gem);

  // ── きらめき：十字の光点が面の上でまたたく ──
  var cv=document.createElement('canvas');cv.width=cv.height=128;var x=cv.getContext('2d');
  var gr=x.createRadialGradient(64,64,0,64,64,64);gr.addColorStop(0,'rgba(255,255,255,1)');gr.addColorStop(.12,'rgba(255,248,230,.9)');gr.addColorStop(.35,'rgba(255,240,210,.15)');gr.addColorStop(1,'rgba(255,240,210,0)');
  x.fillStyle=gr;x.fillRect(0,0,128,128);
  x.globalCompositeOperation='lighter';
  [[128,3],[3,128]].forEach(function(s){var l=x.createLinearGradient(0,0,s[0]===128?128:0,s[0]===128?0:128);l.addColorStop(0,'rgba(255,255,255,0)');l.addColorStop(.5,'rgba(255,255,255,.95)');l.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=l;x.fillRect(64-s[0]/2,64-s[1]/2,s[0],s[1]);});
  var tex=new T.CanvasTexture(cv), glints=[];
  var spots=[Tb[0],Tb[3],S[1],S[5],G[3],G[10],G[13],Tb[6],S[7]];
  spots.forEach(function(p,i){
    var sp=new T.Sprite(new T.SpriteMaterial({map:tex,transparent:true,depthWrite:false,blending:T.AdditiveBlending}));
    sp.position.copy(p).multiplyScalar(1.01);sp.userData={ph:i*1.7,sp:.8+i*.13};gem.add(sp);glints.push(sp);
  });

  // ── 舞う微光 ──
  var dg=new T.BufferGeometry(),n=110,pp=new Float32Array(n*3);
  for(var m=0;m<n;m++){pp[m*3]=(Math.random()-.5)*7;pp[m*3+1]=(Math.random()-.5)*4;pp[m*3+2]=(Math.random()-.5)*4-1;}
  dg.setAttribute('position',new T.BufferAttribute(pp,3));
  var dust=new T.Points(dg,new T.PointsMaterial({color:0xF2E6CC,size:.022,transparent:true,opacity:.55,depthWrite:false}));scene.add(dust);

  var t0=performance.now(), visible=true;
  function frame(now){
    var t=reduce?4.2:(now-t0)/1000;
    uni.uTime.value=t;
    gem.rotation.y=t*.18;
    gem.updateMatrixWorld(true);uni.uCamO.value.copy(cam.position);mesh.worldToLocal(uni.uCamO.value);
    var m4=new T.Matrix4().extractRotation(mesh.matrixWorld);uni.uRot.value.setFromMatrix4(m4);
    glints.forEach(function(s){var u=s.userData,k=Math.pow(Math.max(0,Math.sin(t*u.sp+u.ph)),14);s.scale.setScalar(.05+k*.42);s.material.opacity=k;});
    dust.rotation.y=t*.02;dust.position.y=Math.sin(t*.3)*.08;
    renderer.render(scene,cam);
    if(!reduce&&visible) requestAnimationFrame(frame);
  }
  if('IntersectionObserver' in window){new IntersectionObserver(function(e){var vis=e[0].isIntersecting;if(vis&&!visible&&!reduce){visible=true;requestAnimationFrame(frame);}visible=vis;}).observe(host);}
  requestAnimationFrame(frame);
  window.addEventListener('resize',function(){W=host.clientWidth;H=host.clientHeight;cam.aspect=W/H;cam.updateProjectionMatrix();renderer.setSize(W,H);if(reduce)frame(performance.now());});
})();
