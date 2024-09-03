FROM node:latest
WORKDIR /getCover
# Copy package.json files from working directory to docker directory
COPY ./package.json ./
# Copy package-lock.json files from working directory to docker directory
COPY ./package-lock.json ./
#copy other files
COPY . ./
#Install the packages 
RUN npm run allInstall

EXPOSE 3001
CMD ["npm", "run","start"]