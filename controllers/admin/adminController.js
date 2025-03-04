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

            // Add payment status filter to only show paid orders
            const query = {
                ...dateQuery,
                'orderItems': {
                    $elemMatch: {
                        paymentStatus: 'Paid'
                    }
                }
            };

            const orders = await Order.find(query)
                .populate({
                    path: 'orderItems.product',
                    select: 'productName productImage brand category',
                    populate: {
                        path: 'category',
                        select: 'name'
                    }
                })
                .populate('userId', 'firstName lastName phone')
                .select('orderItems status paymentMethod createdOn address userId discount')
                .sort({ createdOn: -1 });

            // Filter out refunded items and recalculate totals
            const ordersWithPaidItemsOnly = orders.map(order => {
                const orderObj = order.toObject();
                // Only keep paid items, explicitly exclude refunded
                orderObj.orderItems = orderObj.orderItems.filter(item => 
                    item.paymentStatus === 'Paid'
                );

                // Recalculate totals for only paid items
                const totalPrice = orderObj.orderItems.reduce((sum, item) => 
                    sum + (item.price * item.quantity), 0
                );
                
                // Apply discount proportionally to paid items only
                const discountPerItem = orderObj.discount / order.orderItems.length;
                const adjustedDiscount = discountPerItem * orderObj.orderItems.length;
                
                orderObj.totalPrice = totalPrice;
                orderObj.discount = adjustedDiscount;
                orderObj.finalAmount = totalPrice - adjustedDiscount;

                return orderObj;
            });

            // Modify aggregations to only count paid items
            const topProducts = ordersWithPaidItemsOnly.reduce((acc, order) => {
                order.orderItems.forEach(item => {
                    if (item.product && item.paymentStatus === 'Paid') {
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

            const topCategories = ordersWithPaidItemsOnly.reduce((acc, order) => {
                order.orderItems.forEach(item => {
                    if (item.product && item.product.category && 
                        item.product.category.name && 
                        item.paymentStatus === 'Paid') {
                        const categoryName = item.product.category.name;
                        if (!acc[categoryName]) {
                            acc[categoryName] = 0;
                        }
                        acc[categoryName] += item.quantity;
                    }
                });
                return acc;
            }, {});

            const topBrands = ordersWithPaidItemsOnly.reduce((acc, order) => {
                order.orderItems.forEach(item => {
                    if (item.product && item.product.brand && 
                        item.paymentStatus === 'Paid') {
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
                orders: ordersWithPaidItemsOnly,
                filterInfo: {
                    type: filterType || 'all',
                    startDate: startDate || '',
                    endDate: endDate || ''
                },
                topProducts: top2Products,
                topCategories: top2Categories,
                topBrands: top2Brands,
                currentFilter: filterType || 'all'
            });

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
        const orders = await Order.find({
            ...dateQuery,
            'orderItems': {
                $elemMatch: {
                    paymentStatus: 'Paid'
                }
            }
        })
            .populate({ path: 'orderItems.product', select: 'productName productImage brand category', 
                populate: { path: 'category', select: 'name' } 
            })
            .populate('userId', 'firstName lastName phone')
            .select('orderItems status paymentMethod paymentStatus createdOn address userId discount finalAmount')
            .sort({ createdOn: -1 });

        // Further filter to only include paid items and recalculate totals
        const ordersWithPaidItemsOnly = orders.map(order => {
            const orderObj = order.toObject();
            
            // Only keep paid items
            orderObj.orderItems = orderObj.orderItems.filter(item => 
                item.paymentStatus === 'Paid'
            );

            // Recalculate totals for only paid items
            const totalPrice = orderObj.orderItems.reduce((sum, item) => 
                sum + (item.price * item.quantity), 0
            );
            
            // Apply discount proportionally to paid items only
            const discountPerItem = orderObj.discount / order.orderItems.length;
            const adjustedDiscount = discountPerItem * orderObj.orderItems.length;
            
            orderObj.totalPrice = totalPrice;
            orderObj.discount = adjustedDiscount;
            orderObj.finalAmount = totalPrice - adjustedDiscount;

            return orderObj;
        }).filter(order => order.orderItems.length > 0);

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
            const totalOrders = ordersWithPaidItemsOnly.length;
            const totalPrice = ordersWithPaidItemsOnly.reduce((sum, order) => 
                sum + order.totalPrice, 0);
            const totalDiscount = ordersWithPaidItemsOnly.reduce((sum, order) => 
                sum + order.discount, 0);
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
            ordersWithPaidItemsOnly.forEach((order, index) => {
                order.orderItems.forEach(item => {
                    if (item.product) {
                        const itemDiscount = order.discount / order.orderItems.length; // Distribute discount evenly
                        const itemFinalAmount = (item.price * item.quantity) - itemDiscount;
                        
                        table.rows.push([
                            (index + 1).toString(),
                            new Date(order.createdOn).toLocaleDateString(),
                            order.userId ? `${order.userId.firstName} ${order.userId.lastName}` : 'N/A',
                            item.product.productName || 'N/A',
                            item.quantity.toString(),
                            `Rs ${(item.price * item.quantity).toFixed(2)}`,
                            `Rs ${itemDiscount.toFixed(2)}`,
                            `Rs ${itemFinalAmount.toFixed(2)}`
                        ]);
                    }
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

            // Add title
            worksheet.mergeCells('A1:H1');
            worksheet.getCell('A1').value = 'EUPHORIA';
            worksheet.getCell('A1').alignment = { horizontal: 'center' };
            worksheet.getCell('A1').font = { size: 16, bold: true };

            worksheet.mergeCells('A2:H2');
            worksheet.getCell('A2').value = 'Sales Report';
            worksheet.getCell('A2').alignment = { horizontal: 'center' };
            worksheet.getCell('A2').font = { size: 14, bold: true };

            // Add summary section
            worksheet.addRow([]);
            worksheet.addRow(['Summary']);
            worksheet.getRow(4).font = { bold: true, underline: true };

            // Calculate summary data using the same logic as PDF
            const totalOrders = ordersWithPaidItemsOnly.length;
            const totalPrice = ordersWithPaidItemsOnly.reduce((sum, order) => 
                sum + order.totalPrice, 0);
            const totalDiscount = ordersWithPaidItemsOnly.reduce((sum, order) => 
                sum + order.discount, 0);
            const netProfit = totalPrice - totalDiscount;

            // Add summary table
            worksheet.addRow(['Total Orders', 'Total Price', 'Total Discounts', 'Net Profit']);
            worksheet.addRow([
                totalOrders,
                `Rs ${totalPrice.toFixed(2)}`,
                `Rs ${totalDiscount.toFixed(2)}`,
                `Rs ${netProfit.toFixed(2)}`
            ]);

            // Style summary table
            worksheet.getRow(5).font = { bold: true };
            ['A5:A6', 'B5:B6', 'C5:C6', 'D5:D6'].forEach(range => {
                worksheet.getCell(range).alignment = { horizontal: 'center' };
            });

            // Add space before order details
            worksheet.addRows([[], [], ['Order Details']]);
            worksheet.getRow(9).font = { bold: true, underline: true };

            // Add order details header
            const headers = ['#', 'Date', 'Customer', 'Product', 'Quantity', 'Price', 'Discount', 'Final Amount'];
            worksheet.addRow(headers);
            worksheet.getRow(10).font = { bold: true };

            // Add order details data using the same logic as PDF
            ordersWithPaidItemsOnly.forEach((order, index) => {
                order.orderItems.forEach(item => {
                    if (item.product) {
                        const itemDiscount = order.discount / order.orderItems.length; // Distribute discount evenly
                        const itemFinalAmount = (item.price * item.quantity) - itemDiscount;

                        worksheet.addRow([
                            index + 1,
                            new Date(order.createdOn).toLocaleDateString(),
                            order.userId ? `${order.userId.firstName} ${order.userId.lastName}` : 'N/A',
                            item.product.productName || 'N/A',
                            item.quantity,
                            `Rs ${(item.price * item.quantity).toFixed(2)}`,
                            `Rs ${itemDiscount.toFixed(2)}`,
                            `Rs ${itemFinalAmount.toFixed(2)}`
                        ]);
                    }
                });
            });

            // Style all cells
            worksheet.columns.forEach(column => {
                column.alignment = { horizontal: 'center' };
                column.width = 15;
            });

            // Set response headers
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename=euphoria-sales-report-${filterType || 'all'}.xlsx`);

            // Send the workbook
            await workbook.xlsx.write(res);
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