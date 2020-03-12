# Dynamodb-geosearch Proof of Concept #
## Description ##
This proof of concept was built to show the ability to do geosearching in AWS DynamoDB. It uses open source software to geocode and store/read/update geopoints in dynamo.
* [Dynamodb-geo](https://www.npmjs.com/package/dynamodb-geo)
* [Geocodio](geocod.io)

## AWS Resources ##
The CloudFormation script (template.yaml) will deploy a handful of serverless resources to your AWS account:
* **1 x Public API** (API Gateway)
* **1 x NoSQL Table** (DynamoDB)
* **4 x CRUD Functions** (Lambda)
* **4 x Roles with Policies** (IAM)

## Prerequisites ##
In order to properly run and deploy this app, you must perform the following
1. [Setup an AWS account](https://aws.amazon.com/premiumsupport/knowledge-center/create-and-activate-aws-account/)
2. [Install the AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/install-cliv2.html)
3. [Configure the AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/cli-chap-configure.html) to use your account
4. [Setup an S3 bucket](https://docs.aws.amazon.com/AmazonS3/latest/user-guide/create-bucket.html)
5. [Sign up](https://dash.geocod.io/register) for a free Geocodio api key
6. [Install Git](https://git-scm.com/downloads)

## Setup ##
1. Clone the repository to your local machine
2. In the **template.yaml** file, change REPLACE_ME with your Geocodio api key
3. In the root **package.json**, change REPLACE_ME with the name of your S3 bucket

## Deployment ##
You are able to deploy the solution any way you'd like, but included in the root package.json is a script that will automatically build, package, and deploy the solution to AWS for you. Just run the following command to deploy
```
npm run deploy
```
