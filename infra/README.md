# Infrastructure as Code

Terraform configuration for LLM Drift Sentinel infrastructure.

## Prerequisites

1. Install Terraform: https://www.terraform.io/downloads
2. Install Google Cloud SDK: https://cloud.google.com/sdk/docs/install
3. Authenticate:
```bash
gcloud auth login
gcloud auth application-default login
```

## Quick Start

1. **Configure variables:**
```bash
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your project_id, region, and environment
```

2. **Initialize Terraform:**
```bash
terraform init
```

If using a GCS backend (optional, for team collaboration):
```bash
# First, bootstrap the backend (one-time)
cd bootstrap
cp terraform.tfvars.example terraform.tfvars
# Edit with your project_id and unique bucket name
terraform init && terraform apply

# Then configure main infra
cd ..
cp backend.tfvars.example backend.tfvars
# Edit with the bucket name from bootstrap output
terraform init -backend-config=backend.tfvars
```

3. **Deploy infrastructure:**
```bash
terraform plan   # Review changes
terraform apply  # Deploy
```

## What Gets Created

- **APIs**: Vertex AI, Pub/Sub, BigQuery, Cloud Run, Artifact Registry
- **Artifact Registry**: Docker repository for images
- **Service Accounts**: Gateway and Analyzer with proper IAM roles
- **Cloud Run Services**: Gateway, Analyzer, and Frontend
- **Pub/Sub**: Topic and subscription for telemetry
- **BigQuery**: Dataset and tables for telemetry storage

## Deployment Workflow

1. **Build and push images:**
```bash
./scripts/deploy.sh
```

2. **Deploy with Terraform:**
```bash
cd infra
terraform apply
```

3. **For code updates (after initial deployment):**
```bash
./scripts/deploy.sh
./scripts/update-cloud-run.sh  # Faster than terraform apply
```

## Remote Backend Setup (Optional)

For team collaboration, store Terraform state in a GCS bucket:

1. **Bootstrap backend:**
```bash
cd bootstrap
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your project_id and unique bucket name
terraform init
terraform apply
```

2. **Get bucket name:**
```bash
terraform output backend_bucket_name
```

3. **Configure main infra:**
```bash
cd ..
cp backend.tfvars.example backend.tfvars
# Edit backend.tfvars with the bucket name from step 2
terraform init -backend-config=backend.tfvars
```

**Note**: After first init with backend, you can use `terraform init` normally.

## Outputs

Get service URLs after deployment:
```bash
terraform output gateway_service_url
terraform output analyzer_service_url
terraform output frontend_service_url
```

## Cleanup

To destroy all resources:
```bash
terraform destroy
```

**Warning**: This will delete all infrastructure. Make sure you have backups if needed.

