

const ExcelJS = require('exceljs');

console.log("file running")

async function createExcelFileWithMultipleSheets(data, fileName) {
    // Initialize a new workbook
    const workbook = new ExcelJS.Workbook();

    // Loop through each array and create a sheet
    data.forEach((sheetData, index) => {
        // Add a worksheet
        const worksheet = workbook.addWorksheet(`Sheet${index + 1}`);

        // Assume each array is an array of objects
        if (sheetData.length > 0) {
            // Get headers from the first object keys
            const headers = Object.keys(sheetData[0]);

            // Add headers to the sheet
            worksheet.addRow(headers);

            // Add rows from the data
            sheetData.forEach(row => {
                worksheet.addRow(Object.values(row));
            });
        }
    });

    // Write the workbook to a file
    await workbook.xlsx.writeFile(fileName);
    console.log(`Excel file ${fileName} has been created successfully!`);
}

// Example usage
const data = [
    [
        { Name: 'John', Age: 30, Job: 'Engineer' },
        { Name: 'Jane', Age: 25, Job: 'Doctor' },
    ],
    [
        { Product: 'Laptop', Price: 1000, Quantity: 10 },
        { Product: 'Phone', Price: 500, Quantity: 50 },
    ],
];

const filePath = '/home/anil/Documents/Projects/node_js main/get-cover/controllers/Claim';

createExcelFileWithMultipleSheets(data, filePath);
