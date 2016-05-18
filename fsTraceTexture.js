var fsTraceSrc =
`
  precision highp float;

  const vec2 kAtlasSize = vec2(16, 16);
  const vec3 kTexSize = vec3(256);
  const float kExtraSamples = 100.0 / 95.0;
  const int kStepCount = int(kExtraSamples * kTexSize.x);
  const float kStep = 1.0 / kTexSize.x;
  const vec3 kBoxMin = vec3(-0.5);
  const vec3 kBoxMax = vec3(0.5);
  const float kDensityModifier = 1.0;
  const float kMinDensity = 0.05;

  varying vec3 viewDirToNormalize;

  uniform vec4 time;
  uniform vec3 eye;
  uniform sampler2D tex;
  uniform int opacityTrace;

  bool IsInsideAABB(vec3 pos) {
    return kBoxMin.x <= pos.x && kBoxMin.y <= pos.y && kBoxMin.z <= pos.z &&
           pos.x <= kBoxMax.x && pos.y <= kBoxMax.y && pos.z <= kBoxMax.z;
  }

  vec3 GetTexCoord(vec3 pos) {
    vec3 texCoord = (pos - kBoxMin) / (kBoxMax - kBoxMin);
    texCoord.y *= -1.0; // OpenGL convention
    return texCoord;
  }

  bool GetIntersectionWithAABB(vec3 eye, vec3 viewDir,
                               out float tmin, out float tmax) {
    for (int i = 0; i < 3; ++i) {
      float t1 = (kBoxMin[i] - eye[i]) / viewDir[i];
      float t2 = (kBoxMax[i] - eye[i]) / viewDir[i];

      if (i == 0) {
        tmin = min(t1, t2);
        tmax = max(t1, t2);
      } else {
        tmin = max(tmin, min(t1, t2));
        tmax = min(tmax, max(t1, t2));
      }
    }

    return tmax >= tmin;
  }

  vec2 AtlasLocalToGlobalTexcoord(vec2 texCoord, vec2 atlascoord) {
    return (texCoord + atlascoord) / kAtlasSize;
  }

  vec2 Convert3DTexCoord(vec2 texCoord, float depth) {
    float row = floor(depth / kAtlasSize.x);
    float column = depth - row*kAtlasSize.x;
    return AtlasLocalToGlobalTexcoord(texCoord, vec2(column, row));
  }

  float GetDensity(vec3 texCoord) {
    float z = texCoord.z*kTexSize.z;
    float z1 = floor(z), z2 = z1 + 1.0;
    float density1 = texture2D(tex, Convert3DTexCoord(texCoord.xy, z1)).r;
    float density2 = texture2D(tex, Convert3DTexCoord(texCoord.xy, z2)).r;
    return mix(density1, density2, fract(z));
  }

  vec3 GetNormal(vec3 texCoord, out float len) {
    vec3 normal;
    normal.x = GetDensity(texCoord + vec3(kStep, 0, 0)) - GetDensity(texCoord - vec3(kStep, 0, 0));
    normal.y = GetDensity(texCoord + vec3(0, kStep, 0)) - GetDensity(texCoord - vec3(0, kStep, 0));
    normal.z = GetDensity(texCoord + vec3(0, 0, kStep)) - GetDensity(texCoord - vec3(0, 0, kStep));
    len = length(normal);
    return normal / len;
  }

  vec3 GetLighting(vec3 normal) {
    float dotValue = dot(normal, vec3(0, 1, 0.2));
    float lighting = 0.5*max(dotValue, 0.0) + 0.15*(dotValue+1.0) + 0.2;
    return lighting * vec3(1.0, 0.8, 0.82);
  }

  vec3 GetLighting(vec3 normal, float normalLen) {
    float dotValue = dot(normal, vec3(0, 1, 0.2));
    float lighting = 0.5*max(dotValue, 0.0) + 0.15*(dotValue + 0.5 + 0.5*normalLen) + 0.2;
    return lighting * vec3(1.0, 0.8, 0.82);
  }

  float GetTexelDistance(vec3 viewDir) {
    float tmin = 0.0, tmax = 0.0;
    GetIntersectionWithAABB(vec3(0.0), viewDir, tmin, tmax);
    return (tmax-tmin) / float(kStepCount);
  }

  void main() {
    vec3 viewDir = normalize(viewDirToNormalize);
    float tmin = 0.0, tmax = 0.0;
    if (!IsInsideAABB(eye) && !GetIntersectionWithAABB(eye, viewDir, tmin, tmax)) {
      gl_FragColor = vec4(vec3(0.0), 1.0);
      return;
    }

    vec3 pos = eye + viewDir * tmin;
    float texelDistance = GetTexelDistance(viewDir);
    float sumContrib = 0.0;
    vec3 sumColor = vec3(0.0);
    vec3 texCoord = GetTexCoord(pos), lastTexCoord = texCoord;
    float lastDensity = 0.0;
    float normalLen;
    for (int i = 0; i < kStepCount * 2; ++i) {
      float density = GetDensity(texCoord);
      if (opacityTrace == 0) {
        if (density > kMinDensity) {
          texCoord = mix(texCoord, lastTexCoord, (density - kMinDensity) / (density - lastDensity));
          density = GetDensity(texCoord);

          vec3 normal = GetNormal(texCoord, normalLen);
          sumContrib = 1.0;
          sumColor = GetLighting(normal, normalLen) * (0.8 + 0.2 * normalLen);
          break;
        }
      } else {
        if (density > 0.0) {
          vec3 normal = GetNormal(texCoord, normalLen);
          normalLen = clamp(normalLen, 0.0, 1.0);

          float contrib = min(density * kDensityModifier, 1.0 - sumContrib) * (0.1 + 0.9 * normalLen);
          sumContrib += contrib;
          sumColor += contrib * GetLighting(normal, normalLen);
          if (sumContrib >= 1.0) {
            break;
          }
        }
      }

      pos += viewDir * texelDistance * (opacityTrace == 0 ? 0.5 : 1.0);
      lastDensity = density;
      lastTexCoord = texCoord;
      texCoord = GetTexCoord(pos);
      if (!IsInsideAABB(pos)) {
        break;
      }
    }

    if (sumContrib == 0.0) {
      gl_FragColor = vec4(vec3(0.0), 1.0);
    } else {
      gl_FragColor = vec4(sumColor, 1.0);
    }
  }

`
;

