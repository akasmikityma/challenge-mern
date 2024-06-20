//all the api controllers are wriiten here >>
import { PrismaClient } from "@prisma/client";
import { Prisma, } from "@prisma/client";
import { Request, Response } from "express";
import { getTotalAmount } from "../api2helpers/gettotalsaleamount";
import { getNotSoldProductsByMonth } from "../api2helpers/helper";
import { getProdsByRange } from "../api3helpers/bar";
import { seeding_data } from "../seeding";
import { startOfMonth,endOfMonth } from "date-fns";
const prisma = new PrismaClient();

interface rangetype{
  start:number,
  end:number
}

interface TotalAmountResult {
  sum: number;
  noOfSoldThisMonth: number;
}

interface Product {
  id: number;
  title: string;
  price: number;
  description: string;
  category: string;
  image: string;
  sold: boolean;
  dateOfSale: Date|string;
}


export const getAllProductTransactions = async (req: Request, res: Response) => {
  const { search = "", page = "1", perPage = "10", month } = req.query;

  const pageNumber = Number(page);
  const perPageNumber = Number(perPage);

  try {
    const searchNumber = parseFloat(search as string);

    let whereClause: any = search
      ? {
          OR: [
            { title: { contains: search as string, mode: "insensitive" } },
            { description: { contains: search as string, mode: "insensitive" } },
            ...(isNaN(searchNumber) ? [] : [{ price: { equals: searchNumber } }]),
          ],
        }
      : {};

    if (month) {
      const monthNumber = Number(month);
      if (!isNaN(monthNumber) && monthNumber >= 1 && monthNumber <= 12) {
        const year = 2022; // Assuming we only have data up to 2022
        const startDate = startOfMonth(new Date(Date.UTC(year, monthNumber - 1, 1)));
        const endDate = endOfMonth(new Date(Date.UTC(year, monthNumber - 1, 1)));

        whereClause.AND = [
          ...(whereClause.AND || []),
          { dateOfSale: { gte: startDate, lt: endDate } },
        ];

        console.log(`Filtering by month: ${monthNumber}`);
        console.log(`Start date: ${startDate.toISOString()}`);
        console.log(`End date: ${endDate.toISOString()}`);
      }
    }

    console.log("Constructed whereClause:", JSON.stringify(whereClause, null, 2));

    const products = await prisma.product.findMany({
      where: whereClause,
      skip: (pageNumber - 1) * perPageNumber,
      take: perPageNumber,
    });

    const totalProducts = await prisma.product.count({ where: whereClause });

    res.json({
      data: products,
      pagination: {
        total: totalProducts,
        page: pageNumber,
        perPage: perPageNumber,
      },
    });
  } catch (error) {
    console.error("Error fetching product transactions:", error);
    res.status(500).json({ error: "Something went wrong" });
  }
};




export const getallstatictics = async (req: Request, res: Response) => {
  try {
    const monthString = req.query.month;

    if (typeof monthString === 'string' && !isNaN(Number(monthString))) {
      const month = Number(monthString); // Safe conversion to number

      const resultFromSold: TotalAmountResult | null = await getTotalAmount(month);
      const resultFromnotSold = await getNotSoldProductsByMonth(month);

      // const resultFromSold:TotalAmountResult|null=await getTotalAmount(month);
      // const resultFromnotSold=await getNotSoldProductsByMonth(month);
      if(resultFromSold&&resultFromnotSold){
        res.json({
          total_sale:resultFromSold.sum,
          noOfSoldProds:resultFromSold.noOfSoldThisMonth,
          noOfNotSoldProds:resultFromnotSold
        })
      }

    } else {
      // Handle invalid month (e.g., return error)
      console.error("Invalid month parameter. Please provide a valid number.");
      res.status(400).json({ error: "Invalid month parameter" });
    }
  } catch (err) {
    console.error("Error in getallstatictics:", err);
    res.status(500).json({ error: "Something went wrong" });
  }
};

// ---------------------  bar Data ----------------------------

export const getBarData=async(req:Request,res:Response)=>{
    try{
      const monthString = req.query.month;

    if (typeof monthString === 'string' && !isNaN(Number(monthString))) {
      const month = Number(monthString); // Safe conversion to number

      const bardata= await getProdsByRange(month)
      
      // const resultFromSold:TotalAmountResult|null=await getTotalAmount(month);
      // const resultFromnotSold=await getNotSoldProductsByMonth(month);
      res.json({
        bardata
      })

    } else {
      // Handle invalid month (e.g., return error)
      console.error("Invalid month parameter. Please provide a valid number.");
      res.status(400).json({ error: "Invalid month parameter" });
    }
    }catch(err){
      console.log(err)
    }
} 


// ------cateory wise data -----------------




const uniqueCategories = new Set<string>();

export let myArray: string[] = [];
for (let i = 0; i < seeding_data.length; i++) {
    uniqueCategories.add(seeding_data[i].category);
}
myArray = [...uniqueCategories];
console.log(myArray);

const client = new PrismaClient();

export const getItemsEachCategory = async (month: number) => {
    let resArray: {
        category: string,
        noOf: number
    }[] = [];

    try {
        for (let i = 0; i < myArray.length; i++) {
            const items = await client.product.findMany({
                where: {
                    category: myArray[i]
                },
                select: {
                    title: true,
                    category: true,
                    dateOfSale: true
                }
            });

            const filteredProducts = items.filter(product => {
                const productMonth = new Date(product.dateOfSale).getMonth() + 1; // Ensure dateOfSale is a Date object
                return productMonth === month;
            });

            resArray.push({ category: myArray[i], noOf: filteredProducts.length });
        }

        console.log(resArray);
        return resArray;
    } catch (err) {
        console.log(err);
        throw err; // It's a good practice to throw the error after logging it
    }
};
export const getDataByCategory = async (req: Request, res: Response) => {
    try {
        const { month } = req.body;
        const noOfItemsArr = await getItemsEachCategory(month);
        res.status(200).json({
           noOfItemsArr
        });
    } catch (err) {
        console.log(err);
        res.status(500).json({ error: "An error occurred while fetching data" });
    }
};

export const allCombined=async(req:Request,res:Response)=>{
  try{
    const month=req.body;
    const noOfItemsArr = await getItemsEachCategory(month);  //by category
    console.log(`baler `,noOfItemsArr)
    const resultProds=await getProdsByRange(month);   //bar data
   
    const resultFromSold:TotalAmountResult|null=await getTotalAmount(month);  //stats data
    const resultFromnotSold=await getNotSoldProductsByMonth(month);

    // ----all prods-----
    const { search = "", page = "1", perPage = "10" } = req.query;

    const pageNumber = Number(page);
    const perPageNumber = Number(perPage);
  
   
      const searchNumber = parseFloat(search as string);
      const whereClause = search
        ? {
            OR: [
              { title: { contains: search as string, mode: "insensitive" } },
              { description: { contains: search as string, mode: "insensitive" } },
              ...(isNaN(searchNumber) ? [] : [{ price: { equals: searchNumber } }]),
            ],
          }
        : {};
  
      const products = await prisma.product.findMany({
        where: whereClause as any,
        skip: (pageNumber - 1) * perPageNumber,
        take: perPageNumber,
      });
   
    return res.status(200).json({
      catgory_wise: noOfItemsArr,
      barData: resultProds,
      monthStats: {
        total_sale:resultFromSold?.sum,
        noOfSoldProds:resultFromSold?.noOfSoldThisMonth,
        noOfNotSoldProds:resultFromnotSold
      },
      allprods:products
    })

  }catch(err){
    console.log(err)
  }
}
