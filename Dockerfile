FROM node:latest
RUN mkdir -p /getCover/src/app
WORKDIR /getCover/src/app
COPY package.json /getCover/src/app
RUN npm install
COPY . /getCover/src/app
EXPOSE 3001
CMD ["npm", "run","start"]