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

## Remote Backend Setup (One-time)

Terraform state is stored remotely in a GCS bucket for team collaboration.

1. Bootstrap the backend bucket:
```bash
cd bootstrap
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your project_id and unique bucket name
terraform init
terraform apply
```

2. Note the bucket name from output:
```bash
terraform output backend_bucket_name
```

3. Configure backend in main infra:
```bash
cd ..
cp backend.tfvars.example backend.tfvars
# Edit backend.tfvars with the bucket name from step 2
```

## Main Infrastructure Setup

1. Copy example variables:
```bash
cp terraform.tfvars.example terraform.tfvars
```

2. Edit `terraform.tfvars` with your project ID:
```hcl
project_id  = "your-actual-project-id"
region      = "us-central1"
environment = "dev"
```

3. Initialize Terraform with backend:
```bash
terraform init -backend-config=backend.tfvars
```

4. Review plan:
```bash
terraform plan
```

5. Apply:
```bash
terraform apply
```

**Note**: After first init with backend, you can use `terraform init` normally. The backend config is stored in `.terraform/`.

## What Gets Created

- **Vertex AI API**: Enabled for Gemini model access
- **Pub/Sub API**: Enabled for telemetry pipeline (Phase 2)
- **BigQuery API**: Enabled for telemetry storage (Phase 2)
- **Cloud Run API**: Enabled for service deployment

## Next Steps

After Phase 1, we'll add:
- Pub/Sub topics and subscriptions
- BigQuery datasets and tables
- Cloud Run service definitions
- IAM roles and service accounts

## Cleanup

To destroy all resources:
```bash
terraform destroy
```

**Note**: This will disable APIs but won't delete your project.

