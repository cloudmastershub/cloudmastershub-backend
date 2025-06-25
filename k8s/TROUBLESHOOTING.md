# Backend Kubernetes Troubleshooting Guide

## Common Issues and Solutions

### 1. HTTPS API Timeout with CloudFlare 524 Error

**Symptoms:**
- `curl https://api.cloudmastershub.com/health` times out
- CloudFlare returns 524 error (connection timeout)
- `curl http://api.cloudmastershub.com/health` works fine

**Root Cause:** Missing CloudFlare-compatible ingress annotations

**Solution:**
```bash
# Add backend-protocol annotation
kubectl annotate ingress cloudmastershub-ingress -n cloudmastershub-dev \
  nginx.ingress.kubernetes.io/backend-protocol=HTTP --overwrite

# Restart ingress controller to pick up changes
kubectl rollout restart deployment/ingress-nginx-controller -n ingress-nginx
```

**Verification:**
```bash
# Should return 200 status
curl -s -w "Status: %{http_code}\n" https://api.cloudmastershub.com/health
```

### 2. Backend Services Cannot Communicate (ETIMEDOUT)

**Symptoms:**
- API Gateway logs show: `Proxy error for /courses: connect ETIMEDOUT`
- Services can't reach each other internally
- Individual service health checks work

**Root Cause:** Missing network policy for inter-service communication

**Solution:**
```bash
# Apply backend-to-backend network policy
kubectl apply -f /home/master/my-apps/CloudMastersHub/BackEnd/k8s/backend-to-backend-networkpolicy.yaml

# Restart API gateway to pick up new connectivity
kubectl rollout restart deployment/cloudmastershub-api-gateway -n cloudmastershub-dev
```

**Test Connectivity:**
```bash
# Test from API gateway to course service
kubectl exec -n cloudmastershub-dev deployment/cloudmastershub-api-gateway -- \
  nc -zv cloudmastershub-course-service.cloudmastershub-dev.svc.cluster.local 3002
```

### 3. Network Policy Issues

**Check Current Policies:**
```bash
kubectl get networkpolicies -n cloudmastershub-dev
```

**Required Policies:**
- `default-deny-all`: Baseline security
- `allow-dns`: DNS resolution
- `allow-internet-access`: External connections
- `ingress-to-backend`: Ingress to backend services
- `backend-to-backend`: Inter-service communication
- `backend-to-database`: Database access

**Missing Policy Symptoms:**
- Connection timeouts between services
- DNS resolution failures
- External API calls failing

### 4. Ingress Configuration Issues

**Check Ingress Status:**
```bash
kubectl get ingress -n cloudmastershub-dev
kubectl describe ingress cloudmastershub-ingress -n cloudmastershub-dev
```

**Required Annotations for CloudFlare:**
```yaml
nginx.ingress.kubernetes.io/ssl-redirect: "false"
nginx.ingress.kubernetes.io/backend-protocol: "HTTP"
nginx.ingress.kubernetes.io/enable-cors: "true"
nginx.ingress.kubernetes.io/cors-allow-origin: "https://cloudmastershub.com"
```

### 5. Service Discovery Issues

**Check Service Endpoints:**
```bash
kubectl get svc -n cloudmastershub-dev
kubectl get endpoints -n cloudmastershub-dev
```

**Test Internal DNS:**
```bash
# From any pod, test DNS resolution
kubectl exec -n cloudmastershub-dev deployment/cloudmastershub-api-gateway -- \
  nslookup cloudmastershub-course-service.cloudmastershub-dev.svc.cluster.local
```

### 6. Pod Health Issues

**Check Pod Status:**
```bash
kubectl get pods -n cloudmastershub-dev
kubectl describe pod <pod-name> -n cloudmastershub-dev
```

**Check Logs:**
```bash
kubectl logs <pod-name> -n cloudmastershub-dev --tail=50
```

**Restart Deployments:**
```bash
kubectl rollout restart deployment/<deployment-name> -n cloudmastershub-dev
```

## Quick Diagnostic Commands

### Complete System Check
```bash
#!/bin/bash
echo "=== Pod Status ==="
kubectl get pods -n cloudmastershub-dev

echo -e "\n=== Service Status ==="
kubectl get svc -n cloudmastershub-dev

echo -e "\n=== Ingress Status ==="
kubectl get ingress -n cloudmastershub-dev

echo -e "\n=== Network Policies ==="
kubectl get networkpolicies -n cloudmastershub-dev

echo -e "\n=== Health Checks ==="
curl -s -w "Frontend: %{http_code}\n" -o /dev/null https://cloudmastershub.com
curl -s -w "API HTTPS: %{http_code}\n" -o /dev/null https://api.cloudmastershub.com/health
curl -s -w "API HTTP: %{http_code}\n" -o /dev/null http://api.cloudmastershub.com/health
```

### Service Communication Test
```bash
# Test API Gateway to all services
kubectl exec -n cloudmastershub-dev deployment/cloudmastershub-api-gateway -- \
  nc -zv cloudmastershub-user-service.cloudmastershub-dev.svc.cluster.local 3001

kubectl exec -n cloudmastershub-dev deployment/cloudmastershub-api-gateway -- \
  nc -zv cloudmastershub-course-service.cloudmastershub-dev.svc.cluster.local 3002

kubectl exec -n cloudmastershub-dev deployment/cloudmastershub-api-gateway -- \
  nc -zv cloudmastershub-lab-service.cloudmastershub-dev.svc.cluster.local 3003
```

## Emergency Recovery Commands

### Reset Network Policies
```bash
# Remove all custom network policies (use with caution)
kubectl delete networkpolicy backend-to-backend -n cloudmastershub-dev
kubectl apply -f /home/master/my-apps/CloudMastersHub/BackEnd/k8s/backend-to-backend-networkpolicy.yaml
```

### Reset Ingress Annotations
```bash
# Remove all custom annotations and reapply
kubectl annotate ingress cloudmastershub-ingress -n cloudmastershub-dev \
  nginx.ingress.kubernetes.io/backend-protocol- \
  nginx.ingress.kubernetes.io/ssl-redirect-

# Reapply correct annotations
kubectl annotate ingress cloudmastershub-ingress -n cloudmastershub-dev \
  nginx.ingress.kubernetes.io/backend-protocol=HTTP \
  nginx.ingress.kubernetes.io/ssl-redirect=false
```

### Complete Service Restart
```bash
# Restart all backend services
kubectl rollout restart deployment/cloudmastershub-api-gateway -n cloudmastershub-dev
kubectl rollout restart deployment/cloudmastershub-user-service -n cloudmastershub-dev
kubectl rollout restart deployment/cloudmastershub-course-service -n cloudmastershub-dev
kubectl rollout restart deployment/cloudmastershub-lab-service -n cloudmastershub-dev

# Wait for all deployments to be ready
kubectl rollout status deployment/cloudmastershub-api-gateway -n cloudmastershub-dev
kubectl rollout status deployment/cloudmastershub-user-service -n cloudmastershub-dev
kubectl rollout status deployment/cloudmastershub-course-service -n cloudmastershub-dev
kubectl rollout status deployment/cloudmastershub-lab-service -n cloudmastershub-dev
```

## Reference Links

- [Network Policies Documentation](https://kubernetes.io/docs/concepts/services-networking/network-policies/)
- [Nginx Ingress Annotations](https://kubernetes.github.io/ingress-nginx/user-guide/nginx-configuration/annotations/)
- [CloudFlare SSL Configuration](https://developers.cloudflare.com/ssl/origin-configuration/)