const Category = require("../../models/categorySchema")
const Product = require("../../models/productSchema");

const categoryInfo = async(req,res)=>{
    try {
      if(!req.session.admin){
        return res.redirect("/admin/login");
      }
        const page = parseInt(req.query.page) || 1;
        const limit =4;
        const skip = (page-1)*limit;

        const categoryData = await Category.find({})
        .sort({createdAt:-1})
        .skip(skip)
        .limit(limit);

        const totalCategories = await Category.countDocuments();
        const totaPages = Math.ceil(totalCategories/limit);
        res.render("category",{cat:categoryData,currentPage:page,totalPages:totaPages,totalCategories:totalCategories});


    } catch (error) {
        console.error(error);
        res.redirect("/pageError");
    }
}

const addCategory = async (req, res) => {
  

    const {name,description} = req.body
    console.log(name);
    console.log(description);
     
    // console.log(name, categoryDescription);
    const trimName = name.trim();
    try {
    const existingCategory = await Category.findOne({
        name: { $regex: `^${trimName}$`, $options: "i" },
    });
      console.log(existingCategory);
  
      if (existingCategory) {
        return res.status(400).json({ error: "Category already exists" });
      }
  
      const newCategory = new Category({
        name,
        categoryDescription : description,
      });
      console.log(newCategory)
  
      await newCategory.save();
      res.json({ message: "Category added successfully" });
    } catch (error) {
      return res.status(500).json({ error: "Internal Server Error" });
    }
}

const addCategoryOffer = async (req, res) => {
    try {
        const percentage = parseInt(req.body.percentage);
        const categoryId = req.body.categoryId;
  
        const category = await Category.findById(categoryId);
        if (!category) {
            return res.status(404).json({ status: false, message: "Category not found" });
        }
        await Category.updateOne({ _id: categoryId }, { $set: { categoryOffer: percentage } });
        res.json({ status: true });
    } catch (error) {
        res.status(500).json({ status: false, message: "Internal Server Error" });
    }
}

const removeCategoryOffer = async (req, res) => {
    try {
        const categoryId = req.body.categoryId;
        const category = await Category.findById(categoryId);
  
        if (!category) {
            return res.status(404).json({ status: false, message: "Category not found" });
        }
  
        const percentage = category.categoryOffer;
        const products = await Product.find({ category: category._id });  
  
        if (products.length > 0) {
            for (const product of products) {
                product.salePrice = product.oldPrice
                await prodect.save();
            }
        }
  
        category.categoryOffer = 0;
        await category.save();
        res.json({ status: true });
  
    } catch (error) {
        res.status(500).json({ status: false, message: "Internal Server Error" });
        console.log("Remove category offer error", error);
    }
}

const listCategory = async(req,res)=>{
    try {
      let id= req.query.id;
      await Category.updateOne({_id:id},{$set:{isListed:false}});
      return res.redirect("/admin/category");
    } catch (error) {
      return res.redirect("/error");
    };
}

const unlistCategory = async(req,res)=>{
    try {
      const id= req.query.id;
      await Category.updateOne({_id:id},{$set:{isListed:true}});
      return res.redirect("/admin/category")
    } catch (error) {
       return res.redirect("/error");
    }
  
}

const loadEditCategory = async(req,res)=>{
    console.log("load edit page");
    try {
      const id = req.query.id;
      const category= await Category.findOne({_id:id});
      const msg = req.query.msg ||"";
      res.render("editcategory",{category:category,msg});
   
    } catch (error) {
      res.redirect("/pageError")
    }
}

const editCategory = async (req,res)=>{
    try {
      const id = req.params.id;
      const {categoryName,description} =req.body;
      const trimmedCategoryName = categoryName.trim();
      const existingCategory = await Category.findOne({ name: { $regex: `^${trimmedCategoryName}$`, $options: "i" } });
      // const existingCategory = await Category.findOne({name:categoryName});
      
      if(existingCategory){
        return res.status(400).redirect(`/admin/editCategory?msg=category already exists&id=${existingCategory._id}`);
      }
      
      const updatecategory = await Category.findByIdAndUpdate(id,{
        name:categoryName,
        categoryDescription:description,
      },{new:true});
      if(updatecategory){
        return res.redirect("/admin/category");
      }else{
        res.status(404).json({error:"Category not found"});
      }
  
  
  
      } catch (error) {
      res.status(500).json({error:"Internal Server error"});
    }
}

  module.exports = {
    categoryInfo,
    addCategory,
    addCategoryOffer,
    removeCategoryOffer,
    listCategory,
    unlistCategory,
    loadEditCategory,
    editCategory
}