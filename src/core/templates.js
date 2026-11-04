// YAML 템플릿 로드 (Vite ?raw import → js-yaml 파싱). 브라우저·Vitest 모두 동작.
import yaml from 'js-yaml';
import registryRaw from '../templates/registry.yaml?raw';
import contractRaw from '../templates/contract.yaml?raw';

export const TEMPLATES = [yaml.load(registryRaw), yaml.load(contractRaw)];
