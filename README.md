## Project Description

This project is designed to manage an insurance company, providing functionality for different user types: admin, dealer, reseller, servicer, and customer. Dealers and resellers can also work as servicers. The system includes sections for price book categories, price books, dealer price books, managing users, orders, contracts, claims, and reporting.

## Prerequisites

Ensure you have Node.js version 20.12.1 and MongoDB version 6.3 installed.

## User Roles

    Admin: Manages all aspects of the system, including user accounts and system settings.
    Dealer: Manages dealer-specific price books, orders, contracts, and claims. Can also act as a servicer.
    Reseller: Manages reseller-specific price books, orders, contracts, and claims. Can also act as a servicer.
    Servicer: Manages services related to insurance claims.
    Customer: Views and manages their insurance policies, orders, and claims.

## Sections

    Price Book Categories: Manage categories for price books.
    Price Book: Manage the general price book.
    Dealer Price Book: Manage price books specific to dealers.
    Dealers: Manage dealer information.
    Servicers: Manage servicer information.
    Customers: Manage customer information.
    Resellers: Manage reseller information.
    Admin's User List in Manage Account Section: Admin can manage all user accounts.
    Orders: Manage orders placed by customers.
    Contracts: Manage contracts related to insurance policies.
    Claims: Manage insurance claims.
    Reportings: Generate and view various reports.

## installation || Get cover project server functions is developed by using node js and mongodb

## Step 1: Install Node.js 20.12.1

    Download Node.js 20.12.1:
        ->Visit the Node.js official website.
        ->Download the installer for version 20.12.1 for your operating system.

    Install Node.js:
        ->Run the installer and follow the prompts to complete the installation.

    Verify the installation:
        ->Open a terminal or command prompt.
        ->Run the following command to check the installed version "node -v"
        ->You should see v20.12.1 as the output.

## Step 2: Install MongoDB 6.3

    Download MongoDB 6.3:
        ->Visit the MongoDB official website.
        ->Select version 6.3 and the appropriate platform for your operating system.

    Install MongoDB:
        ->Follow the installation instructions for your operating system.

    Verify the installation:
        ->Open a terminal or command prompt.
        ->Run the following command to check the MongoDB server version "mongod --version"
        ->You should see db version v6.3.x as the output.

## Step 3: Set Up a Node.js Project from Git

    Clone the Repository:
        ->Open a terminal or command prompt.
        ->Run the following command to clone the repository "git clone giturl"ask admin for the repository url"
        ->Navigate to the Project Directory:
             Change into the project directory:
             cd yourproject
        ->Install Project Dependencies:
            Ensure you are in the project directory where the package.json file is located.
            Run the following command to install the project dependencies:
            "npm run allInstall"
        ->Run the Application:
            -Open a terminal or command prompt.
            -Navigate to your project directory if you're not already there.
            -Run the following command to start the application "node index.js" (do not forget to include the .env file in the root)
            -output shoult be like this:-
                        users Server is running on port 8080
                        Service server is running on port 8084
                        customer Server is running on port 8085
                        Contract server is running on port 8089
                        Dealer server is running on port 8082
                        Contract server is running on port 8087
                        Service server is running on port 8086
                        Price server is running on port 8083
                        app listening at http://localhost:3002
                        MongoDB :: connected getcover_test1
                        MongoDB :: connected getcover_reporting_test1
