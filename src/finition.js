// Finition « cinéma » : traînée anamorphique sur les étoiles vives, aberration chromatique, vignettage, grain de pellicule,
// et flou de zoom pour l'entrée cinématique.
import * as THREE from 'three';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

export function creerFinition(mobile) {
  return new ShaderPass({
    uniforms: {
      tDiffuse: { value: null }, uTime: { value: 0 }, uCinema: { value: .8 }, uClair: { value: 0 }, uWarp: { value: 0 },
      uRes: { value: new THREE.Vector2(1, 1) }, uFlare: { value: mobile ? 0 : 1 },
    },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime; uniform float uCinema; uniform float uClair; uniform float uWarp; uniform vec2 uRes; uniform float uFlare; varying vec2 vUv;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233)))*43758.5453); }
      void main(){
        vec2 uv = vUv, d = uv - .5; float r = length(d);
        vec3 col;
        if (uWarp > .001) {                                            // flou de zoom : tout file vers les bords
          col = vec3(0.);
          for (int i = 0; i < 10; i++) col += texture2D(tDiffuse, uv - d*uWarp*float(i)/10.).rgb;
          col /= 10.;
        } else {
          vec2 ca = d * .0035 * uCinema * (.4 + r*r*2.);               // aberration chromatique, plus forte vers les bords
          col = vec3(texture2D(tDiffuse, uv + ca).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv - ca).b);
        }
        if (uFlare > .5 && uCinema > .01 && uClair < .5) {             // traînée horizontale bleutée sur ce qui est vraiment vif
          vec3 acc = vec3(0.);
          for (int i = -12; i <= 12; i++) {
            vec3 s = texture2D(tDiffuse, uv + vec2(float(i)*4./uRes.x, 0.)).rgb;
            float l = max(max(s.r, s.g), s.b);
            acc += s * smoothstep(.9, 1.5, l) * exp(-abs(float(i))*.22);
          }
          col += acc * vec3(.35, .55, 1.) * .09 * uCinema;
        }
        col *= 1. - uCinema*mix(.5, .16, uClair)*smoothstep(.32, .95, r*1.35);   // vignettage
        // (plus de grain de pellicule : sur téléphone il faisait un voile qui vibre, « Canal+ crypté »)
        gl_FragColor = vec4(col, 1.);
      }`,
  });
}
