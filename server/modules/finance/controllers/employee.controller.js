const Employee = require('../models/Employee');
const SalaryPayment = require('../models/SalaryPayment');

exports.getEmployees = async (req, res) => {
  try {
    const employees = await Employee.find().sort({ name: 1 });
    res.json(employees);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.createEmployee = async (req, res) => {
  try {
    const data = { ...req.body };
    // Seed salary history with the starting salary from day one, so that
    // any future hike has a proper "before" value to fall back on.
    data.salaryHistory = [{ amount: Number(data.monthlySalary), effectiveFrom: data.joiningDate }];
    // An empty string from a blank date input would fail Mongoose's Date cast.
    if (data.leavingDate === '') data.leavingDate = null;
    const employee = await Employee.create(data);
    res.status(201).json(employee);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

exports.updateEmployee = async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id);
    if (!employee) return res.status(404).json({ message: 'Employee not found' });

    // salaryEffectiveFrom is an optional hint from the client for *when* a
    // salary change should kick in. It's never stored on the employee itself.
    // leavingDate is handled separately below so a blank date input (empty
    // string) can be used to clear it back to null instead of failing the
    // Date cast.
    const { monthlySalary, salaryEffectiveFrom, leavingDate, ...rest } = req.body;

    Object.assign(employee, rest);

    if (leavingDate !== undefined) {
      employee.leavingDate = leavingDate ? new Date(leavingDate) : null;
    }

    if (monthlySalary !== undefined && Number(monthlySalary) !== employee.monthlySalary) {
      // Employees created before salary history existed may have an empty
      // array — backfill with their current salary before adding the hike,
      // so past months still resolve to what they were actually paid.
      if (!employee.salaryHistory || employee.salaryHistory.length === 0) {
        employee.salaryHistory = [{ amount: employee.monthlySalary, effectiveFrom: employee.joiningDate }];
      }
      const effectiveFrom = salaryEffectiveFrom ? new Date(salaryEffectiveFrom) : new Date();
      employee.salaryHistory.push({ amount: Number(monthlySalary), effectiveFrom });
      employee.monthlySalary = Number(monthlySalary);
    } else if (monthlySalary !== undefined) {
      employee.monthlySalary = Number(monthlySalary);
    }

    await employee.save();
    res.json(employee);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

exports.deleteEmployee = async (req, res) => {
  try {
    const employee = await Employee.findByIdAndDelete(req.params.id);
    if (!employee) return res.status(404).json({ message: 'Employee not found' });
    res.json({ message: 'Employee deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};