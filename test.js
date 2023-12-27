const createCsvWriter = require('csv-writer').createObjectCsvWriter;

console.log('1st_________________')

// Your array of objects
const data = [
  { name: 'John', age: 28, city: 'New York' },
  { name: 'Alice', age: 32, city: 'San Francisco' },
  // Add more objects as needed
];
console.log('2nd------------------------')

// Specify the headers for your CSV file
const csvWriter = createCsvWriter({
  path: './config/'+Date.now(), // Change this to the desired file name
  header: [
    { id: 'name', title: 'Name' },
    { id: 'age', title: 'Age' },
    { id: 'city', title: 'City' },
    // Add more headers as needed
  ],
});

// Write the data to the CSV file
csvWriter.writeRecords(data)
  .then(() => console.log('CSV file written successfully'))
  .catch((err) => console.error(err));
