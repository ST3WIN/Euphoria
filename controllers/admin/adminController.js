const User = require("../../models/userSchema")
const mongoose = require("mongoose")
const bcrypt = require("bcrypt")
const Order = require("../../models/orderSchema")
const PDFDocument = require('pdfkit')
const ExcelJS = require('exceljs')
const path = require('path')

const pageError = async(req,res)=>{
    res.render("pageError")
}

const loadLogin = (req,res)=>{
    try {
        if(req.session.admin){
            return res.redirect("/admin/dashboard")
        }
        res.render("admin-login",{message:null}) 
    } catch (error) {
        console.log("Error",error)
        
    }
    
}

const login = async(req,res)=>{
    try {
        const email = req.body.email
        const password = req.body.password
        const admin = await User.findOne({email,isAdmin:true})
        if(admin){
            const passwordMatch = await bcrypt.compare(password,admin.password)
            if(passwordMatch){
                req.session.admin = true
                return res.redirect("/admin")
            }else{
                return res.redirect("/admin/login")
            }
        }else{
            res.redirect("/admin/login")
        }
    } catch (error) {
        console.log("Login error",error);
        return res.redirect("/pageError")       
    }
}

const loadDashBoard = async (req, res) => {
    if (req.session.admin) {
        try {
            const { filterType, startDate, endDate } = req.query;
            let dateQuery = {};

            // Build date query based on filter type
            if (filterType) {
                const now = new Date();
                switch (filterType) {
                    case 'daily':
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        dateQuery = {
                            createdOn: {
                                $gte: today,
                                $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000)
                            }
                        };
                        break;

                    case 'weekly':
                        const weekStart = new Date();
                        weekStart.setDate(now.getDate() - now.getDay());
                        weekStart.setHours(0, 0, 0, 0);
                        dateQuery = {
                            createdOn: {
                                $gte: weekStart,
                                $lt: new Date()
                            }
                        };
                        break;

                    case 'monthly':
                        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
                        dateQuery = {
                            createdOn: {
                                $gte: monthStart,
                                $lt: new Date()
                            }
                        };
                        break;

                    case 'yearly':
                        const yearStart = new Date(now.getFullYear(), 0, 1);
                        dateQuery = {
                            createdOn: {
                                $gte: yearStart,
                                $lt: new Date()
                            }
                        };
                        break;

                    case 'custom':
                        if (startDate && endDate) {
                            const endDateTime = new Date(endDate);
                            endDateTime.setHours(23, 59, 59, 999);
                            dateQuery = {
                                createdOn: {
                                    $gte: new Date(startDate),
                                    $lte: endDateTime
                                }
                            };
                        }
                        break;
                }
            }

            // Fetch orders with date filter
            const orders = await Order.find(dateQuery)
                .populate({
                    path: 'orderItems.product',
                    select: 'productName productImage brand category',
                    populate: {
                        path: 'category',
                        select: 'name'
                    }
                })
                .populate('userId', 'firstName lastName phone')
                .select('orderItems status paymentMethod paymentStatus createdOn address userId discount')
                .sort({ createdOn: -1 });

            // Aggregate top selling products
            const topProducts = orders.reduce((acc, order) => {
                order.orderItems.forEach(item => {
                    if (item.product) {
                        const productId = item.product._id.toString();
                        if (!acc[productId]) {
                            acc[productId] = {
                                name: item.product.productName || 'Unknown Product',
                                quantity: 0
                            };
                        }
                        acc[productId].quantity += item.quantity;
                    }
                });
                return acc;
            }, {});

            // Aggregate top selling categories
            const topCategories = orders.reduce((acc, order) => {
                order.orderItems.forEach(item => {
                    if (item.product && item.product.category && item.product.category.name) {
                        const categoryName = item.product.category.name;
                        if (!acc[categoryName]) {
                            acc[categoryName] = 0;
                        }
                        acc[categoryName] += item.quantity;
                    }
                });
                return acc;
            }, {});

            // Aggregate top selling brands
            const topBrands = orders.reduce((acc, order) => {
                order.orderItems.forEach(item => {
                    if (item.product && item.product.brand) {
                        const brand = item.product.brand;
                        if (!acc[brand]) {
                            acc[brand] = 0;
                        }
                        acc[brand] += item.quantity;
                    }
                });
                return acc;
            }, {});

            // Get top 2 of each
            const top2Products = Object.entries(topProducts)
                .sort((a, b) => b[1].quantity - a[1].quantity)
                .slice(0, 2);

            const top2Categories = Object.entries(topCategories)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 2);

            const top2Brands = Object.entries(topBrands)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 2);

            res.render("dashboard", { 
                orders,
                filterInfo: {
                    type: filterType || 'all',
                    startDate: startDate || '',
                    endDate: endDate || ''
                },
                topProducts: top2Products,
                topCategories: top2Categories,
                topBrands: top2Brands,
                currentFilter: filterType || 'all'
            })
            
        } catch (error) {
            console.error("Error loading dashboard:", error);
            res.redirect("/pageError");
        }
    } else {
        res.redirect("/admin/login");
    }
}

const logout = async(req,res)=>{
    try {
        req.session.destroy(err =>{
            if(err){
                // console.log("Error destroying session admin",err);
                return res.redirect("/pageError")
            }
            res.redirect("/admin/login")
        })
    } catch (error) {
        console.log("admin logout error",error)
        res.redirect("/pageError")
    }
}

const downloadSalesReport = async (req, res) => {
    try {
        const format = req.params.format;
        const { filterType, startDate, endDate } = req.query;
        
        const now = new Date();
        let dateQuery = {};
        
        // Date filtering logic
        if (filterType) {
            switch (filterType) {
                case 'daily':
                    dateQuery = { createdOn: { $gte: new Date().setHours(0, 0, 0, 0), $lt: new Date().setHours(23, 59, 59, 999) } };
                    break;
                case 'weekly':
                    const weekStart = new Date();
                    weekStart.setDate(now.getDate() - now.getDay());
                    weekStart.setHours(0, 0, 0, 0);
                    dateQuery = { createdOn: { $gte: weekStart, $lt: now } };
                    break;
                case 'monthly':
                    dateQuery = { createdOn: { $gte: new Date(now.getFullYear(), now.getMonth(), 1), $lt: now } };
                    break;
                case 'yearly':
                    dateQuery = { createdOn: { $gte: new Date(now.getFullYear(), 0, 1), $lt: now } };
                    break;
                case 'custom':
                    if (startDate && endDate) {
                        dateQuery = { createdOn: { $gte: new Date(startDate), $lte: new Date(endDate).setHours(23, 59, 59, 999) } };
                    }
                    break;
            }
        }

        // Fetch orders based on the filter
        const orders = await Order.find(dateQuery)
            .populate({ path: 'orderItems.product', select: 'productName productImage brand' })
            .populate('userId', 'firstName lastName phone')
            .select('orderItems status paymentMethod paymentStatus createdOn address userId discount')
            .sort({ createdOn: -1 });

        if (format === 'pdf') {
            const doc = new PDFDocument({ margin: 30, size: 'A4', layout: 'landscape' });
            
            // Set response headers
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename=euphoria-sales-report-${filterType || 'all'}.pdf`);
            doc.pipe(res);
            
            // Add store name and title
            doc.fontSize(24).text('EUPHORIA', { align: 'center' });
            doc.moveDown(0.5);
            doc.fontSize(20).text('Sales Report', { align: 'center' });
            doc.moveDown();
            
            // Add summary section
            doc.fontSize(12).text('Summary', { underline: true });
            
            // Calculate summary data
            const totalOrders = orders.length;
            const totalPrice = orders.reduce((sum, order) => 
                sum + order.orderItems.reduce((itemSum, item) => itemSum + (item.price * item.quantity), 0), 0);
            const totalDiscount = orders.reduce((sum, order) => sum + (order.discount || 0), 0);
            const netProfit = totalPrice - totalDiscount;
            
            const summaryTable = {
                headers: ['Total Orders', 'Total Price', 'Total Discounts', 'Net Profit'],
                rows: [[
                    totalOrders,
                    `Rs ${totalPrice.toFixed(2)}`,
                    `Rs ${totalDiscount.toFixed(2)}`,
                    `Rs ${netProfit.toFixed(2)}`
                ]]
            };
            
            // Draw summary table
            const summaryColumnWidth = 150;
            const summaryStartX = 30;
            let currentX = summaryStartX;
            let currentY = doc.y + 10;
            
            // Draw summary headers
            summaryTable.headers.forEach(header => {
                doc.text(header, currentX, currentY, {
                    width: summaryColumnWidth,
                    align: 'center'
                });
                currentX += summaryColumnWidth;
            });
            
            // Draw summary data
            currentY += 20;
            currentX = summaryStartX;
            summaryTable.rows[0].forEach(cell => {
                doc.text(cell, currentX, currentY, {
                    width: summaryColumnWidth,
                    align: 'center'
                });
                currentX += summaryColumnWidth;
            });
            
            doc.moveDown(2);
            
            // Add orders table
            doc.fontSize(12).text('Order Details', { underline: true });
            doc.moveDown();
            
            // Define table structure
            const table = {
                headers: ['#', 'Date', 'Customer', 'Product', 'Quantity', 'Price', 'Discount', 'Final Amount'],
                rows: []
            };
            
            // Populate table data
            orders.forEach((order, index) => {
                order.orderItems.forEach(item => {
                    table.rows.push([
                        (index + 1).toString(),
                        new Date(order.createdOn).toLocaleDateString(),
                        order.userId ? `${order.userId.firstName} ${order.userId.lastName}` : 'N/A',
                        item.product ? item.product.productName : 'N/A',
                        item.quantity.toString(),
                        `Rs ${(item.price * item.quantity).toFixed(2)}`,
                        `Rs ${(order.discount || 0).toFixed(2)}`,
                        `Rs ${((item.price * item.quantity) - (order.discount || 0)).toFixed(2)}`
                    ]);
                });
            });
            
            // Draw orders table
            const columnWidth = 90;
            const startX = 30;
            currentX = startX;
            currentY = doc.y + 10;
            
            // Draw headers
            table.headers.forEach(header => {
                doc.text(header, currentX, currentY, {
                    width: columnWidth,
                    align: 'center'
                });
                currentX += columnWidth;
            });
            
            // Draw data rows
            currentY += 20;
            table.rows.forEach(row => {
                currentX = startX;
                row.forEach(cell => {
                    doc.text(cell, currentX, currentY, {
                        width: columnWidth,
                        align: 'center'
                    });
                    currentX += columnWidth;
                });
                currentY += 20;
                
                // Add a new page if we're near the bottom
                if (currentY > doc.page.height - 50) {
                    doc.addPage();
                    currentY = 50;
                }
            });
            
            doc.end();
        } else if (format === 'excel') {
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Sales Report');

            // Header
            worksheet.addRow(['Euphoria Sales Report']).font = { size: 14, bold: true };
            worksheet.addRow([`Filter: ${filterType || 'All Time'}`]);
            if (filterType === 'custom') worksheet.addRow([`Date Range: ${startDate} to ${endDate}`]);
            worksheet.addRow([]);

            // Column Headers
            worksheet.addRow(['Order ID', 'Date', 'Customer', 'Products', 'Amount (Rs)', 'Status']);

            let totalAmount = 0;
            orders.forEach(order => {
                const orderAmount = order.orderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0) - (order.discount || 0);
                totalAmount += orderAmount;
                const products = order.orderItems.map(item => item.product.productName).join(', ');
                worksheet.addRow([
                    order._id.toString().slice(-6),
                    new Date(order.createdOn).toLocaleDateString(),
                    `${order.userId.firstName} ${order.userId.lastName}`,
                    products,
                    `Rs ${orderAmount.toFixed(2)}`,
                    order.status
                ]);
            });

            worksheet.addRow([]);
            worksheet.addRow(['', '', '', 'Total Amount:', `Rs ${totalAmount.toFixed(2)}`]);
            worksheet.columns.forEach(column => column.width = 20);
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename=euphoria-sales-report-${filterType || 'all'}.xlsx`);
            await workbook.xlsx.write(res);
            res.end();
        }
    } catch (error) {
        console.error('Error generating sales report:', error);
        res.status(500).send('Error generating sales report');
    }
};

module.exports = {
    loadLogin,
    login,
    loadDashBoard,
    pageError,
    logout,
    downloadSalesReport
}