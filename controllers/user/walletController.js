const User = require('../../models/userSchema');
const Wallet = require('../../models/walletSchema');

const addMoneyToWallet = async (req, res) => {
    try {
        const { amount } = req.body;
        const userId = req.session.user;

        if (!amount || amount <= 0) {
            return res.json({
                success: false,
                message: 'Please enter a valid amount'
            });
        }else if(amount<1000){
            return res.json({
                success: false,
                message: 'Minimum amount to load is 1000'
            })
        }else if(amount>100000){
            return res.json({
                success: false,
                message: 'Maxium amount to load is 1,00,000'
            }) 
        }

        // Update user's wallet balance 
        const updatedUser = await User.findByIdAndUpdate(
            userId,
            {
                $inc: { wallet: amount }
            },
            { new: true }
        );

        if (!updatedUser) {
            return res.json({
                success: false,
                message: 'User not found'
            });
        }

        // Create wallet transaction record
        await Wallet.create({
            userId: userId,
            type: 'credit',
            amount: amount,
            description: 'Wallet recharge'
        });

        // Set success message in session
        req.session.orderMessage = {
            type: 'success',
            message: 'Money added to wallet successfully!'
        };

        res.json({
            success: true,
            message: 'Money added to wallet successfully',
            newBalance: updatedUser.wallet
        });

    } catch (error) {
        console.error('Error in addMoneyToWallet:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

const getWalletTransactions = async (userId) => {
    try {
        const transactions = await Wallet.find({ userId: userId })
            .sort({ timestamp: -1 });
        return transactions;
    } catch (error) {
        console.error('Error getting wallet transactions:', error);
        return [];
    }
};

module.exports = {
    addMoneyToWallet,
    getWalletTransactions
};