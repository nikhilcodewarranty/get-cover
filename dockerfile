FROM node:alpine
WORKDIR /getCover/src/app
COPY ./package.json ./
COPY ./package-lock.json ./
RUN npm install
COPY ./.env ./
COPY ./db.js ./
