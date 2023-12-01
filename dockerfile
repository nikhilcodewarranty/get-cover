FROM node:20

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

ENV DB_URL = "mongodb+srv://cameron:N8wdCkcqyQO7oG9D@cluster0.apbn0iy.mongodb.net/"
ENV JWT_SECRET = "GET_COVER_SECRET"
ENV DEALER_API_ENDPOINT = 8082
ENV USERS_API_DATABASE_NAME="USERS"
ENV USER_API_ENDPOINT=8080
EXPOSE 3000
CMD [ "npm", "start" ]