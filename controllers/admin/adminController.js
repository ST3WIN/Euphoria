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
        console.log(admin)
        if(admin){
            const passwordMatch = await bcrypt.compare(password,admin.password)
            console.log(passwordMatch);
            
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

const loadDashBoard = async(req,res)=>{
    if(req.session.admin){
        try {
            const orders = await Order.find()
                .populate({
                    path: 'orderItems.product',
                    select: 'productName productImage brand'
                })
                .populate({
                    path: 'address',
                    select: 'firstName lastName phone'
                })
                .select('orderItems status paymentMethod paymentStatus createdOn address discount')
                .sort({ createdOn: -1 });

            res.render("dashboard", { orders })
        } catch (error) {
            console.error("Error loading dashboard:", error);
            res.redirect("/pageError")
        }
    }else{
        res.redirect("/admin/login")
    }
}

const logout = async(req,res)=>{
    try {
        req.session.destroy(err =>{
            if(err){
                console.log("Error destroying session admin",err);
                return res.redirect("/pageError")
            }
            res.redirect("/admin/login")
        })
    } catch (error) {
        console.log("admin logout error",error);
        res.redirect("/pageError")
    }
}

const downloadSalesReport = async (req, res) => {
    try {
        const format = req.params.format;
        const orders = await Order.find()
            .populate({
                path: 'orderItems.product',
                select: 'productName productImage brand'
            })
            .populate({
                path: 'address',
                select: 'firstName lastName phone'
            })
            .sort({ createdOn: -1 });

        // Calculate totals
        let totalPrice = 0;
        let totalDiscount = 0;
        orders.forEach(order => {
            order.orderItems.forEach(item => {
                totalPrice += (item.price * item.quantity);
            });
            totalDiscount += (order.discount || 0);
        });
        const netProfit = totalPrice - totalDiscount;

        // Function to format currency
        function formatIndianPrice(number) {
            const formattedNumber = number.toLocaleString('en-IN', {
                maximumFractionDigits: 2,
                minimumFractionDigits: 2
            });
            return `Rs. ${formattedNumber}/-`;
        }

        if (format === 'pdf') {
            // Generate PDF
            const doc = new PDFDocument({ margin: 30, size: 'A4', layout: 'landscape' });
            
            // Set response headers
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'attachment; filename=sales-report.pdf');
            
            // Pipe the PDF to the response
            doc.pipe(res);
            
            // Add store name and title
            doc.fontSize(24).text('EUPHORIA', { align: 'center' });
            doc.moveDown(0.5);
            doc.fontSize(20).text('Sales Report', { align: 'center' });
            doc.moveDown();
            
            // Add summary section
            doc.fontSize(12).text('Summary', { underline: true });
            const summaryTable = {
                headers: ['Total Orders', 'Total Price', 'Total Discounts', 'Net Profit'],
                rows: [[
                    orders.length,
                    formatIndianPrice(totalPrice),
                    formatIndianPrice(totalDiscount),
                    formatIndianPrice(netProfit)
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
                        order.address ? `${order.address.firstName} ${order.address.lastName}` : 'N/A',
                        item.product ? item.product.productName : 'N/A',
                        item.quantity.toString(),
                        formatIndianPrice(item.price * item.quantity),
                        formatIndianPrice(order.discount || 0),
                        formatIndianPrice((item.price * item.quantity) - (order.discount || 0))
                    ]);
                });
            });
            
            // Calculate column widths
            const columnWidths = [30, 80, 100, 150, 60, 100, 100, 100];
            const startX = 30;
            const rowHeight = 25;
            let y = doc.y + 10;
            
            // Draw table headers with background
            currentX = startX;
            doc.fillColor('#f0f0f0');
            doc.rect(startX, y, doc.page.width - 60, rowHeight).fill();
            doc.fillColor('#000000');
            
            table.headers.forEach((header, i) => {
                doc.text(header, currentX, y + 7, {
                    width: columnWidths[i],
                    align: 'center'
                });
                currentX += columnWidths[i];
            });
            
            // Draw table rows
            y += rowHeight;
            table.rows.forEach((row, rowIndex) => {
                // Add page if needed
                if (y > doc.page.height - 50) {
                    doc.addPage({ margin: 30, size: 'A4', layout: 'landscape' });
                    y = 30;
                    
                    // Add store name and page title on new page
                    doc.fontSize(16).text('EUPHORIA - Sales Report', { align: 'center' });
                    doc.moveDown();
                    
                    // Redraw table headers
                    currentX = startX;
                    doc.fillColor('#f0f0f0');
                    doc.rect(startX, y, doc.page.width - 60, rowHeight).fill();
                    doc.fillColor('#000000');
                    
                    table.headers.forEach((header, i) => {
                        doc.text(header, currentX, y + 7, {
                            width: columnWidths[i],
                            align: 'center'
                        });
                        currentX += columnWidths[i];
                    });
                    y += rowHeight;
                }
                
                currentX = startX;
                
                // Alternate row background
                if (rowIndex % 2 === 0) {
                    doc.fillColor('#f9f9f9');
                    doc.rect(startX, y, doc.page.width - 60, rowHeight).fill();
                    doc.fillColor('#000000');
                }
                
                // Draw cell borders and content
                row.forEach((cell, i) => {
                    doc.text(cell, currentX, y + 7, {
                        width: columnWidths[i],
                        align: i === 0 ? 'center' : 'left'
                    });
                    currentX += columnWidths[i];
                });
                
                y += rowHeight;
            });
            
            // Add page numbers
            const pages = doc.bufferedPageRange();
            for (let i = 0; i < pages.count; i++) {
                doc.switchToPage(i);
                doc.fontSize(8).text(
                    `Page ${i + 1} of ${pages.count}`,
                    0,
                    doc.page.height - 20,
                    { align: 'center' }
                );
            }
            
            // Finalize PDF
            doc.end();
        } else if (format === 'excel') {
            // Create new workbook and worksheet
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Sales Report');
            
            // Add summary sheet
            const summarySheet = workbook.addWorksheet('Summary');
            summarySheet.addRow(['Sales Report Summary']);
            summarySheet.addRow(['']);
            summarySheet.addRow(['Total Orders', orders.length]);
            summarySheet.addRow(['Total Price', `₹${totalPrice.toLocaleString('en-IN')}`]);
            summarySheet.addRow(['Total Discounts', `₹${totalDiscount.toLocaleString('en-IN')}`]);
            summarySheet.addRow(['Net Profit', `₹${netProfit.toLocaleString('en-IN')}`]);
            
            // Style the summary sheet
            summarySheet.getCell('A1').font = { bold: true, size: 14 };
            summarySheet.getColumn('A').width = 15;
            summarySheet.getColumn('B').width = 20;
            
            // Add headers to main sheet
            worksheet.columns = [
                { header: 'Order #', key: 'orderNum', width: 10 },
                { header: 'Date', key: 'date', width: 15 },
                { header: 'Customer', key: 'customer', width: 20 },
                { header: 'Product', key: 'product', width: 30 },
                { header: 'Quantity', key: 'quantity', width: 10 },
                { header: 'Price', key: 'price', width: 15 },
                { header: 'Discount', key: 'discount', width: 15 },
                { header: 'Final Amount', key: 'finalAmount', width: 15 }
            ];
            
            // Style the header row
            worksheet.getRow(1).font = { bold: true };
            
            // Add order data
            orders.forEach((order, index) => {
                order.orderItems.forEach(item => {
                    worksheet.addRow({
                        orderNum: index + 1,
                        date: new Date(order.createdOn).toLocaleDateString(),
                        customer: order.address ? `${order.address.firstName} ${order.address.lastName}` : 'N/A',
                        product: item.product ? item.product.productName : 'N/A',
                        quantity: item.quantity,
                        price: `₹${(item.price * item.quantity).toLocaleString('en-IN')}`,
                        discount: `₹${(order.discount || 0).toLocaleString('en-IN')}`,
                        finalAmount: `₹${((item.price * item.quantity) - (order.discount || 0)).toLocaleString('en-IN')}`
                    });
                });
            });
            
            // Set response headers
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', 'attachment; filename=sales-report.xlsx');
            
            // Write to response
            await workbook.xlsx.write(res);
            res.end();
        }
    } catch (error) {
        console.error("Error generating sales report:", error);
        res.status(500).send("Error generating sales report");
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