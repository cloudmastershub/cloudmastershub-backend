#!/usr/bin/env node

/**
 * Generate placeholder images for courses
 * This creates simple colored placeholder images for each course category
 */

const fs = require('fs');
const path = require('path');

// Course placeholder configurations
const coursePlaceholders = [
  { name: 'aws-practitioner.svg', category: 'AWS', color: '#FF9900', bgColor: '#232F3E' },
  { name: 'azure-fundamentals.svg', category: 'Azure', color: '#0078D4', bgColor: '#1A1A1A' },
  { name: 'gcp-essentials.svg', category: 'GCP', color: '#4285F4', bgColor: '#F8F9FA' },
  { name: 'kubernetes-mastery.svg', category: 'K8s', color: '#326CE5', bgColor: '#FFF' },
  { name: 'devops-pipeline.svg', category: 'DevOps', color: '#00B4D8', bgColor: '#0D1117' },
  { name: 'multicloud-architect.svg', category: 'Multi', color: '#6366F1', bgColor: '#1F2937' },
  { name: 'security-essentials.svg', category: 'Security', color: '#EF4444', bgColor: '#1F2937' },
  { name: 'data-engineering.svg', category: 'Data', color: '#10B981', bgColor: '#1F2937' },
  { name: 'ai-ml-basics.svg', category: 'AI/ML', color: '#8B5CF6', bgColor: '#1F2937' },
  { name: 'general-computing.svg', category: 'General', color: '#40E0D0', bgColor: '#1F2937' },
];

// Learning path placeholders
const pathPlaceholders = [
  { name: 'aws-architect.svg', title: 'AWS Architect', color: '#FF9900', bgColor: '#232F3E' },
  { name: 'azure-devops.svg', title: 'Azure DevOps', color: '#0078D4', bgColor: '#1A1A1A' },
  { name: 'cloud-security.svg', title: 'Cloud Security', color: '#EF4444', bgColor: '#1F2937' },
];

const imagesDir = path.join(__dirname, '../public/images/courses');
const pathsDir = path.join(__dirname, '../public/images/paths');

// Ensure directories exist
[imagesDir, pathsDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Generate SVG placeholder
function generateSVG(title, color, bgColor, width = 1280, height = 720) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <!-- Background -->
  <rect width="${width}" height="${height}" fill="${bgColor}"/>
  
  <!-- Grid pattern -->
  <defs>
    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
      <path d="M 40 0 L 0 0 0 40" fill="none" stroke="${color}" stroke-width="0.5" opacity="0.1"/>
    </pattern>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#grid)"/>
  
  <!-- Center circle decoration -->
  <circle cx="${width/2}" cy="${height/2}" r="150" fill="${color}" opacity="0.1"/>
  <circle cx="${width/2}" cy="${height/2}" r="100" fill="${color}" opacity="0.15"/>
  <circle cx="${width/2}" cy="${height/2}" r="50" fill="${color}" opacity="0.2"/>
  
  <!-- Title text -->
  <text x="${width/2}" y="${height/2}" font-family="Arial, sans-serif" font-size="72" font-weight="bold" fill="${color}" text-anchor="middle" dominant-baseline="middle">
    ${title}
  </text>
  
  <!-- Subtitle -->
  <text x="${width/2}" y="${height/2 + 60}" font-family="Arial, sans-serif" font-size="28" fill="${color}" opacity="0.7" text-anchor="middle" dominant-baseline="middle">
    CloudMastersHub
  </text>
  
  <!-- Corner decorations -->
  <rect x="20" y="20" width="100" height="4" fill="${color}" opacity="0.5"/>
  <rect x="20" y="20" width="4" height="100" fill="${color}" opacity="0.5"/>
  
  <rect x="${width - 120}" y="20" width="100" height="4" fill="${color}" opacity="0.5"/>
  <rect x="${width - 24}" y="20" width="4" height="100" fill="${color}" opacity="0.5"/>
  
  <rect x="20" y="${height - 24}" width="100" height="4" fill="${color}" opacity="0.5"/>
  <rect x="20" y="${height - 120}" width="4" height="100" fill="${color}" opacity="0.5"/>
  
  <rect x="${width - 120}" y="${height - 24}" width="100" height="4" fill="${color}" opacity="0.5"/>
  <rect x="${width - 24}" y="${height - 120}" width="4" height="100" fill="${color}" opacity="0.5"/>
</svg>`;
}

// Generate course placeholders
console.log('Generating course placeholder images...');
coursePlaceholders.forEach(({ name, category, color, bgColor }) => {
  const svgContent = generateSVG(category, color, bgColor);
  const filePath = path.join(imagesDir, name);
  fs.writeFileSync(filePath, svgContent);
  console.log(`✓ Created ${name}`);
});

// Generate path placeholders
console.log('\nGenerating learning path placeholder images...');
pathPlaceholders.forEach(({ name, title, color, bgColor }) => {
  const svgContent = generateSVG(title, color, bgColor);
  const filePath = path.join(pathsDir, name);
  fs.writeFileSync(filePath, svgContent);
  console.log(`✓ Created ${name}`);
});

// Also create a default placeholder
const defaultSVG = generateSVG('Course', '#40E0D0', '#1F2937');
fs.writeFileSync(path.join(imagesDir, 'default-course.svg'), defaultSVG);
console.log('✓ Created default-course.svg');

console.log('\n✅ All placeholder images generated successfully!');
console.log(`Course images: ${imagesDir}`);
console.log(`Path images: ${pathsDir}`);