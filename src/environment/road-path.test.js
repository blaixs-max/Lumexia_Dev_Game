import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  ROAD_ROUTE_LENGTH, TUNNEL_START, TUNNEL_LENGTH, sampleRoadFrame,
  placeOnRoad, deformRoadGeometry, sampleTunnelAmount, tunnelStartZ,
  roadPositionInsideTunnel,
} from './road-path';

const expectVector = (actual, expected, digits = 5) => actual.forEach((value, index) => expect(value).toBeCloseTo(expected[index], digits));

describe('driver-relative road frames', () => {
  it('anchors the driver at the origin with an aligned tangent throughout the cycle', () => {
    const reusable = {};
    for (const distance of [-30, 0, 275, 650, 1200, 1800, 12345678]) {
      expect(sampleRoadFrame(distance, 0, reusable)).toBe(reusable);
      expectVector([reusable.x, reusable.z, reusable.yaw], [0, 0, 0]);
      const ahead = sampleRoadFrame(distance, -.01);
      expect(Math.abs(ahead.x)).toBeLessThan(.000001);
      expect(ahead.z).toBeLessThan(0);
    }
  });

  it('has a continuous repeating position/tangent and bends in both directions', () => {
    let positive = false, negative = false;
    for (let distance = 0; distance < ROAD_ROUTE_LENGTH; distance += 45) {
      const frame = sampleRoadFrame(distance, -300);
      const repeat = sampleRoadFrame(distance + ROAD_ROUTE_LENGTH, -300);
      expectVector([frame.x, frame.z, frame.yaw], [repeat.x, repeat.z, repeat.yaw]);
      positive ||= frame.x > 10;
      negative ||= frame.x < -10;
    }
    expect(positive && negative).toBe(true);
    const before = sampleRoadFrame(ROAD_ROUTE_LENGTH - .00001, -600);
    const after = sampleRoadFrame(.00001, -600);
    expectVector([before.x, before.z, before.yaw], [after.x, after.z, after.yaw], 3);
  });

  it('places rigid local geometry once and preserves its scale/rotation/offset', () => {
    const local = new THREE.Matrix4().compose(new THREE.Vector3(4.5, 2, 3), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), .3), new THREE.Vector3(2, 3, 4));
    const unchanged = local.clone();
    const frame = sampleRoadFrame(650, -150);
    const expected = new THREE.Matrix4().makeRotationY(frame.yaw);
    expected.setPosition(frame.x, 0, frame.z).multiply(local);
    const target = new THREE.Matrix4();
    expect(placeOnRoad(target, local, -150, 650)).toBe(target);
    expectVector(target.elements, expected.elements);
    expect(local.equals(unchanged)).toBe(true);
    placeOnRoad(local, local, -150, 650);
    expectVector(local.elements, expected.elements);
  });
});

describe('corridor deformation', () => {
  it('matches path frames, supports a translated tunnel group and never compounds deformation', () => {
    const geometry = new THREE.PlaneGeometry(24, 150, 2, 30).rotateX(-Math.PI / 2).translate(0, 0, -75);
    const originalPositions = geometry.attributes.position.array.slice();
    const originalNormals = geometry.attributes.normal.array.slice();
    const sourceCopy = originalPositions.slice();
    const positionArray = geometry.attributes.position.array;
    const normalArray = geometry.attributes.normal.array;
    const distance = 500, front = tunnelStartZ(distance);
    deformRoadGeometry(geometry, originalPositions, originalNormals, distance, front);
    const first = positionArray.slice();
    for (let i = 0; i < originalPositions.length; i += 3) {
      const frame = sampleRoadFrame(distance, originalPositions[i + 2] + front);
      expect(positionArray[i]).toBeCloseTo(frame.x + Math.cos(frame.yaw) * originalPositions[i], 4);
      expect(positionArray[i + 2] + front).toBeCloseTo(frame.z - Math.sin(frame.yaw) * originalPositions[i], 4);
      expectVector(Array.from(normalArray.slice(i, i + 3)), [0, 1, 0]);
      expect(geometry.boundingSphere.containsPoint(new THREE.Vector3().fromArray(positionArray, i))).toBe(true);
    }
    deformRoadGeometry(geometry, originalPositions, originalNormals, 900, front);
    deformRoadGeometry(geometry, originalPositions, originalNormals, distance, front);
    expect(geometry.attributes.position.array).toBe(positionArray);
    expect(geometry.attributes.normal.array).toBe(normalArray);
    expect(Array.from(positionArray)).toEqual(Array.from(first));
    expect(Array.from(originalPositions)).toEqual(Array.from(sourceCopy));
    geometry.dispose();
  });

  it('keeps transformed wall normals perpendicular to the curved surface', () => {
    const distance = 350, x = 12, z = -120;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute([x, 3, z], 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute([1, 0, 0], 3));
    deformRoadGeometry(geometry, geometry.attributes.position.array.slice(), geometry.attributes.normal.array.slice(), distance);
    const normal = new THREE.Vector3().fromBufferAttribute(geometry.attributes.normal, 0);
    const mapped = station => {
      const frame = sampleRoadFrame(distance, station);
      return new THREE.Vector3(frame.x + Math.cos(frame.yaw) * x, 3, frame.z - Math.sin(frame.yaw) * x);
    };
    const tangent = mapped(z + .001).sub(mapped(z - .001)).normalize();
    expect(normal.length()).toBeCloseTo(1, 6);
    expect(normal.dot(tangent)).toBeCloseTo(0, 5);
    expect(normal.dot(new THREE.Vector3(0, 1, 0))).toBeCloseTo(0);
    geometry.dispose();
  });

  it('rejects mutable source aliases rather than silently compounding a curve', () => {
    const geometry = new THREE.PlaneGeometry(10, 10);
    expect(() => deformRoadGeometry(geometry, geometry.attributes.position.array, geometry.attributes.normal.array.slice(), 0)).toThrow(/separate original/);
    geometry.dispose();
  });
});

describe('tunnel station and wrapping', () => {
  it('fades across the 15m entrance and exit without a cycle seam flash', () => {
    expect(sampleTunnelAmount(TUNNEL_START - 1)).toBe(0);
    expect(sampleTunnelAmount(TUNNEL_START)).toBe(0);
    expect(sampleTunnelAmount(TUNNEL_START + 7.5)).toBeCloseTo(.5);
    expect(sampleTunnelAmount(TUNNEL_START + 15)).toBe(1);
    expect(sampleTunnelAmount(TUNNEL_START + TUNNEL_LENGTH - 15)).toBe(1);
    expect(sampleTunnelAmount(TUNNEL_START + TUNNEL_LENGTH - 7.5)).toBeCloseTo(.5);
    expect(sampleTunnelAmount(TUNNEL_START + TUNNEL_LENGTH)).toBe(0);
    expect(sampleTunnelAmount(ROAD_ROUTE_LENGTH - .001)).toBe(0);
    expect(sampleTunnelAmount(ROAD_ROUTE_LENGTH + .001)).toBe(0);
    expect(sampleTunnelAmount(500, -200)).toBe(1);
  });

  it('retains the tunnel until the rear is 80m behind, then recycles out of view', () => {
    expect(tunnelStartZ(0)).toBe(-TUNNEL_START);
    expect(tunnelStartZ(TUNNEL_START)).toBe(0);
    expect(tunnelStartZ(TUNNEL_START + TUNNEL_LENGTH)).toBe(TUNNEL_LENGTH);
    expect(tunnelStartZ(TUNNEL_START + TUNNEL_LENGTH + 79.9)).toBeCloseTo(TUNNEL_LENGTH + 79.9);
    expect(tunnelStartZ(TUNNEL_START + TUNNEL_LENGTH + 80)).toBe(TUNNEL_LENGTH + 80 - ROAD_ROUTE_LENGTH);
    for (const distance of [-200, 0, 700, 900, 1700]) expect(tunnelStartZ(distance + ROAD_ROUTE_LENGTH)).toBeCloseTo(tunnelStartZ(distance));
  });

  it('masks the complete tunnel plus margins in the same logical station space', () => {
    for (const distance of [0, 500, 700, 900, 1800, -1800]) {
      const front = tunnelStartZ(distance);
      expect(roadPositionInsideTunnel(distance, front)).toBe(true);
      expect(roadPositionInsideTunnel(distance, front - TUNNEL_LENGTH)).toBe(true);
      expect(roadPositionInsideTunnel(distance, front + 21, 20)).toBe(false);
      expect(roadPositionInsideTunnel(distance, front + 20, 20)).toBe(true);
      expect(roadPositionInsideTunnel(distance, front - TUNNEL_LENGTH - 20, 20)).toBe(true);
      expect(roadPositionInsideTunnel(distance, front - TUNNEL_LENGTH - 21, 20)).toBe(false);
    }
  });
});
