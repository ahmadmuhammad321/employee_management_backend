You need to add these Headers while sending api requests declared in .env file.

Authorization {Admin_API_KEY or Employee_API_KEY}

user-id {user-id of an employee}

Authorization: is to assign role

user-id: is required in case of identifying which user is trying to access, because an employee can view only its own details

Queries to test are found in queries.txt file

Database Creation and Table Creation

CREATE DATABASE `employee_management` 
CREATE TABLE `employees` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) DEFAULT NULL,
  `age` int(11) DEFAULT NULL,
  `class` varchar(50) DEFAULT NULL,
  `subjects` longtext  DEFAULT NULL CHECK (json_valid(`subjects`)),
  `attendance` tinyint(1) DEFAULT NULL,
  PRIMARY KEY (`id`)
) 

