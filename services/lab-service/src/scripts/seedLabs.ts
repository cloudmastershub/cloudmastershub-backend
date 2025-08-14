import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Lab from '../models/Lab';
import logger from '../utils/logger';

dotenv.config();

const sampleLabs = [
  {
    title: 'Deploy Your First EC2 Instance',
    description: 'Learn the fundamentals of Amazon EC2 by launching, configuring, and connecting to your first virtual machine in the cloud.',
    provider: 'aws' as const,
    difficulty: 'beginner' as const,
    estimatedTime: 45,
    category: 'Compute',
    prerequisites: [
      'AWS Account (Free Tier eligible)',
      'Basic understanding of virtual machines',
      'Familiarity with SSH (optional)'
    ],
    objectives: [
      'Launch an EC2 instance using the AWS Console',
      'Configure security groups and key pairs',
      'Connect to your instance via SSH',
      'Install and configure a web server',
      'Create and attach an Elastic IP'
    ],
    tags: ['ec2', 'compute', 'aws', 'virtual-machine', 'cloud-basics'],
    instructions: [
      {
        step: 1,
        title: 'Navigate to EC2 Dashboard',
        content: 'Log in to your AWS Management Console and navigate to the EC2 service. You can find it under the Compute section or use the search bar.',
        hints: ['Look for EC2 in the services menu', 'Make sure you are in the correct region'],
        validation: { type: 'manual', expected: 'EC2 Dashboard accessed' }
      },
      {
        step: 2,
        title: 'Launch an EC2 Instance',
        content: 'Click "Launch Instance" and select Amazon Linux 2 AMI. Choose t2.micro instance type for free tier eligibility.',
        hints: ['t2.micro is free tier eligible', 'Amazon Linux 2 is optimized for AWS'],
        validation: { type: 'resource_exists', expected: 'ec2_instance' }
      },
      {
        step: 3,
        title: 'Configure Security Group',
        content: 'Create a new security group that allows SSH (port 22) from your IP and HTTP (port 80) from anywhere.',
        hints: ['Be careful with SSH access', 'HTTP should be open to 0.0.0.0/0'],
        validation: { type: 'port_open', expected: [22, 80] }
      },
      {
        step: 4,
        title: 'Connect and Install Web Server',
        content: 'SSH into your instance and install Apache or Nginx web server. Start the service and verify it is running.',
        hints: ['Use the key pair you downloaded', 'sudo yum install httpd -y'],
        validation: { type: 'service_running', expected: 'httpd' }
      }
    ],
    resources: {
      cpuLimit: '1 vCPU',
      memoryLimit: '1 GB',
      timeLimit: 60,
      cloudResources: [
        { type: 'ec2_instance', specifications: { instanceType: 't2.micro', ami: 'ami-amazon-linux-2' } },
        { type: 'security_group', specifications: { rules: ['SSH', 'HTTP'] } },
        { type: 'elastic_ip', specifications: { allocation: 'vpc' } }
      ]
    },
    validation: {
      checkpoints: [
        'EC2 instance is running',
        'Security group configured correctly',
        'Web server is accessible via public IP',
        'Elastic IP attached'
      ],
      autoGrading: true,
      passingScore: 80
    },
    isActive: true
  },
  {
    title: 'Build a Serverless Web Application',
    description: 'Create a complete serverless application using AWS Lambda, API Gateway, and DynamoDB with a modern React frontend.',
    provider: 'aws' as const,
    difficulty: 'intermediate' as const,
    estimatedTime: 90,
    category: 'Serverless',
    prerequisites: [
      'AWS Account with API Gateway and Lambda access',
      'Basic JavaScript/Node.js knowledge',
      'Understanding of RESTful APIs',
      'Git and npm installed locally'
    ],
    objectives: [
      'Create Lambda functions for backend logic',
      'Set up API Gateway for RESTful APIs',
      'Configure DynamoDB for data persistence',
      'Deploy a React frontend to S3',
      'Integrate frontend with serverless backend',
      'Implement authentication with Cognito'
    ],
    tags: ['lambda', 'api-gateway', 'dynamodb', 's3', 'serverless', 'react'],
    instructions: [
      {
        step: 1,
        title: 'Set up DynamoDB Table',
        content: 'Create a DynamoDB table named "TodoItems" with a partition key "userId" and sort key "itemId".',
        hints: ['Use on-demand billing mode', 'Enable point-in-time recovery'],
        validation: { type: 'resource_exists', expected: 'dynamodb_table' }
      },
      {
        step: 2,
        title: 'Create Lambda Functions',
        content: 'Create Lambda functions for CRUD operations: createItem, getItems, updateItem, deleteItem.',
        hints: ['Use Node.js 18.x runtime', 'Attach DynamoDB permissions'],
        validation: { type: 'lambda_functions', expected: 4 }
      },
      {
        step: 3,
        title: 'Configure API Gateway',
        content: 'Create a REST API with endpoints for each Lambda function. Enable CORS and deploy to a stage.',
        hints: ['Use proxy integration', 'Test each endpoint'],
        validation: { type: 'api_endpoints', expected: ['GET', 'POST', 'PUT', 'DELETE'] }
      }
    ],
    resources: {
      cpuLimit: 'N/A (Serverless)',
      memoryLimit: '3008 MB per Lambda',
      timeLimit: 120,
      cloudResources: [
        { type: 'lambda_function', specifications: { runtime: 'nodejs18.x', memory: 256 } },
        { type: 'api_gateway', specifications: { type: 'REST', stage: 'dev' } },
        { type: 'dynamodb_table', specifications: { billingMode: 'PAY_PER_REQUEST' } },
        { type: 's3_bucket', specifications: { hosting: 'static-website' } }
      ]
    },
    validation: {
      checkpoints: [
        'DynamoDB table created and accessible',
        'All Lambda functions deployed',
        'API Gateway endpoints working',
        'Frontend deployed to S3',
        'End-to-end functionality verified'
      ],
      autoGrading: true,
      passingScore: 85
    },
    isActive: true
  },
  {
    title: 'Azure Virtual Network and VM Setup',
    description: 'Master Azure networking by creating virtual networks, subnets, and deploying virtual machines with proper security configurations.',
    provider: 'azure' as const,
    difficulty: 'beginner' as const,
    estimatedTime: 60,
    category: 'Networking',
    prerequisites: [
      'Azure Account (Free tier available)',
      'Basic networking concepts',
      'Understanding of IP addressing and subnets'
    ],
    objectives: [
      'Create and configure Azure Virtual Networks',
      'Set up subnets with proper address spaces',
      'Configure Network Security Groups (NSGs)',
      'Deploy a VM within the VNet',
      'Test connectivity between resources',
      'Set up a bastion host for secure access'
    ],
    tags: ['vnet', 'networking', 'azure', 'nsg', 'virtual-machine'],
    instructions: [
      {
        step: 1,
        title: 'Create Resource Group',
        content: 'Create a new resource group in your preferred region to organize all lab resources.',
        hints: ['Choose a region close to you', 'Use consistent naming'],
        validation: { type: 'resource_exists', expected: 'resource_group' }
      },
      {
        step: 2,
        title: 'Create Virtual Network',
        content: 'Create a VNet with address space 10.0.0.0/16 and two subnets: frontend (10.0.1.0/24) and backend (10.0.2.0/24).',
        hints: ['Plan your address space carefully', 'Leave room for growth'],
        validation: { type: 'vnet_configuration', expected: { subnets: 2 } }
      }
    ],
    resources: {
      cpuLimit: '2 vCPUs',
      memoryLimit: '4 GB',
      timeLimit: 75,
      cloudResources: [
        { type: 'resource_group', specifications: { location: 'eastus' } },
        { type: 'virtual_network', specifications: { addressSpace: '10.0.0.0/16' } },
        { type: 'virtual_machine', specifications: { size: 'Standard_B2s' } },
        { type: 'network_security_group', specifications: { rules: ['SSH', 'HTTP'] } }
      ]
    },
    validation: {
      checkpoints: [
        'Resource group created',
        'VNet with correct address space',
        'Subnets configured properly',
        'NSG rules applied',
        'VM deployed and accessible'
      ],
      autoGrading: false,
      passingScore: 75
    },
    isActive: true
  },
  {
    title: 'Deploy a Kubernetes Application on GKE',
    description: 'Deploy and manage a production-ready microservices application on Google Kubernetes Engine with advanced features.',
    provider: 'gcp' as const,
    difficulty: 'advanced' as const,
    estimatedTime: 120,
    category: 'Containers',
    prerequisites: [
      'GCP Account with billing enabled',
      'Docker and kubectl installed',
      'Basic Kubernetes knowledge',
      'Understanding of microservices architecture',
      'Familiarity with YAML'
    ],
    objectives: [
      'Create a GKE cluster with custom configuration',
      'Deploy a multi-tier microservices application',
      'Implement horizontal pod autoscaling',
      'Set up monitoring with Stackdriver',
      'Configure ingress and load balancing',
      'Implement CI/CD with Cloud Build',
      'Set up persistent storage'
    ],
    tags: ['kubernetes', 'gke', 'containers', 'microservices', 'devops', 'gcp'],
    instructions: [
      {
        step: 1,
        title: 'Create GKE Cluster',
        content: 'Create a GKE cluster with 3 nodes, autoscaling enabled (min: 2, max: 5), and workload identity enabled.',
        hints: ['Use n1-standard-2 machines', 'Enable stackdriver monitoring'],
        validation: { type: 'gke_cluster', expected: { nodes: 3, autoscaling: true } }
      },
      {
        step: 2,
        title: 'Deploy Microservices',
        content: 'Deploy a sample microservices application with frontend, backend API, and database components.',
        hints: ['Use separate namespaces', 'Configure resource limits'],
        validation: { type: 'pods_running', expected: ['frontend', 'backend', 'database'] }
      },
      {
        step: 3,
        title: 'Configure Autoscaling',
        content: 'Set up Horizontal Pod Autoscaler for the backend service based on CPU utilization (target: 70%).',
        hints: ['Set min replicas to 2', 'Set max replicas to 10'],
        validation: { type: 'hpa_configured', expected: { target: 70 } }
      }
    ],
    resources: {
      cpuLimit: '6 vCPUs total',
      memoryLimit: '12 GB total',
      timeLimit: 150,
      cloudResources: [
        { type: 'gke_cluster', specifications: { nodes: 3, machineType: 'n1-standard-2' } },
        { type: 'cloud_load_balancer', specifications: { type: 'HTTP(S)' } },
        { type: 'persistent_disk', specifications: { size: '10GB', type: 'pd-ssd' } },
        { type: 'container_registry', specifications: { location: 'us' } }
      ]
    },
    validation: {
      checkpoints: [
        'GKE cluster operational',
        'All microservices deployed',
        'Autoscaling configured and tested',
        'Monitoring dashboards available',
        'Load balancer distributing traffic',
        'Persistent storage mounted'
      ],
      autoGrading: true,
      passingScore: 90
    },
    isActive: true
  },
  {
    title: 'Multi-Cloud Disaster Recovery Setup',
    description: 'Design and implement a disaster recovery solution spanning AWS and Azure with automated failover capabilities.',
    provider: 'multi-cloud' as const,
    difficulty: 'advanced' as const,
    estimatedTime: 180,
    category: 'Architecture',
    prerequisites: [
      'AWS and Azure accounts',
      'Understanding of DR concepts (RTO/RPO)',
      'Terraform or ARM/CloudFormation knowledge',
      'Database replication concepts',
      'DNS and traffic management'
    ],
    objectives: [
      'Set up primary infrastructure in AWS',
      'Configure secondary site in Azure',
      'Implement database replication',
      'Configure DNS failover with Route53/Traffic Manager',
      'Test failover scenarios',
      'Document recovery procedures'
    ],
    tags: ['disaster-recovery', 'multi-cloud', 'high-availability', 'aws', 'azure'],
    instructions: [
      {
        step: 1,
        title: 'Deploy Primary Site (AWS)',
        content: 'Deploy a web application with RDS database in AWS us-east-1 with Multi-AZ configuration.',
        hints: ['Use Auto Scaling Group', 'Enable automated backups'],
        validation: { type: 'aws_resources', expected: ['asg', 'rds', 'alb'] }
      },
      {
        step: 2,
        title: 'Deploy Secondary Site (Azure)',
        content: 'Create standby infrastructure in Azure East US with Azure SQL Database and App Service.',
        hints: ['Use geo-replication', 'Configure same capacity'],
        validation: { type: 'azure_resources', expected: ['app_service', 'sql_database'] }
      }
    ],
    resources: {
      cpuLimit: '8 vCPUs total',
      memoryLimit: '16 GB total',
      timeLimit: 240,
      cloudResources: [
        { type: 'aws_infrastructure', specifications: { region: 'us-east-1', ha: true } },
        { type: 'azure_infrastructure', specifications: { region: 'eastus', ha: true } },
        { type: 'dns_service', specifications: { provider: 'route53', healthChecks: true } }
      ]
    },
    validation: {
      checkpoints: [
        'Primary site fully operational',
        'Secondary site in standby mode',
        'Database replication working',
        'DNS failover configured',
        'Failover tested successfully',
        'Recovery documentation complete'
      ],
      autoGrading: false,
      passingScore: 95
    },
    isActive: true
  }
];

async function seedDatabase() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://mongodb:27017/cloudmastershub_labs';
    await mongoose.connect(mongoUri);
    logger.info('Connected to MongoDB for seeding');

    // Clear existing labs
    await Lab.deleteMany({});
    logger.info('Cleared existing labs');

    // Insert sample labs
    const insertedLabs = await Lab.insertMany(sampleLabs);
    logger.info(`Successfully seeded ${insertedLabs.length} labs`);

    // Log inserted lab IDs
    insertedLabs.forEach(lab => {
      logger.info(`Created lab: ${lab.title} (ID: ${lab._id})`);
    });

    // Disconnect from MongoDB
    await mongoose.disconnect();
    logger.info('Disconnected from MongoDB');
    
    process.exit(0);
  } catch (error) {
    logger.error('Error seeding database:', error);
    process.exit(1);
  }
}

// Run the seed function
seedDatabase();