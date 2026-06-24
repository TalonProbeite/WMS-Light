from pydantic import BaseModel, ConfigDict



class DashboardStatsResponse(BaseModel):
    total_products: int
    out_of_stock_products: int
    total_categories: int

    model_config = ConfigDict(from_attributes=True)