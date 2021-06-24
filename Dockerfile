FROM mcr.microsoft.com/azure-functions/node:3.0 as build
WORKDIR /app
COPY package.json /app
RUN npm install 
COPY . /app
RUN npm run build  && npm prune --production 

FROM mcr.microsoft.com/azure-functions/node:3.0 as prod

ENV AzureWebJobsScriptRoot=/home/site/wwwroot \
     AzureFunctionsJobHost__Logging__Console__IsEnabled=true

COPY --from=build /app/ /home/site/wwwroot/
