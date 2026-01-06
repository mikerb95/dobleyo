/**
 * MercadoLibre Routes
 * Endpoints for synchronizing and retrieving sales data
 */

import { Router } from 'express';
import MercadoLibreService from '../services/mercadolibre.js';
import * as auth from '../auth.js';
import * as db from '../db.js';

export const mercadolibreRouter = Router();

/**
 * POST /api/mercadolibre/sync
 * Synchronize orders from MercadoLibre
 * Requires: admin role, ML_ACCESS_TOKEN env var, ML_SELLER_ID env var
 */
mercadolibreRouter.post('/sync', auth.requireAuth, auth.requireAdmin, async (req, res) => {
  try {
    const accessToken = process.env.ML_ACCESS_TOKEN;
    const sellerId = process.env.ML_SELLER_ID;

    if (!accessToken || !sellerId) {
      return res.status(400).json({
        error: 'MercadoLibre credentials not configured',
        details: 'Please set ML_ACCESS_TOKEN and ML_SELLER_ID environment variables'
      });
    }

    const mlService = new MercadoLibreService(accessToken);

    // Fetch orders from MercadoLibre
    console.log(`Fetching orders for seller ${sellerId}...`);
    const orders = await mlService.fetchOrders(sellerId);

    if (!orders || orders.length === 0) {
      return res.json({
        success: true,
        message: 'No new orders found',
        count: 0
      });
    }

    // Transform and save each order
    const salesData = [];
    let processed = 0;
    let failed = 0;

    for (const order of orders) {
      try {
        // Fetch full order details
        const orderDetails = await mlService.fetchOrderDetails(order.id);

        // Fetch shipment details if available
        let shipment = null;
        if (orderDetails.shipping && orderDetails.shipping.id) {
          try {
            shipment = await mlService.fetchShipment(orderDetails.shipping.id);
          } catch (shipmentError) {
            console.warn(`Could not fetch shipment for order ${order.id}:`, shipmentError.message);
          }
        }

        // Transform data
        const transformedData = await mlService.transformOrderData(order, orderDetails, shipment);
        salesData.push(transformedData);
        processed++;
      } catch (orderError) {
        console.error(`Error processing order ${order.id}:`, orderError.message);
        failed++;
      }
    }

    // Save all transformed data
    const insertedIds = await mlService.saveSalesData(salesData);

    res.json({
      success: true,
      message: 'Synchronization completed',
      processed,
      failed,
      saved: insertedIds.length,
      total_orders_fetched: orders.length
    });
  } catch (error) {
    console.error('Error in /sync endpoint:', error);
    res.status(500).json({
      error: 'Synchronization failed',
      details: error.message
    });
  }
});

/**
 * GET /api/mercadolibre/sales
 * Get synced sales data from database
 * Requires: admin role
 * Query params: limit, offset, city, state, dateFrom, dateTo
 */
mercadolibreRouter.get('/sales', auth.requireAuth, auth.requireAdmin, async (req, res) => {
  try {
    const {
      limit = 50,
      offset = 0,
      city = null,
      state = null,
      dateFrom = null,
      dateTo = null
    } = req.query;

    const mlService = new MercadoLibreService(process.env.ML_ACCESS_TOKEN);
    const result = await mlService.getSalesData({
      limit: parseInt(limit),
      offset: parseInt(offset),
      city,
      state,
      dateFrom,
      dateTo
    });

    res.json({
      success: true,
      data: result.data,
      pagination: {
        total: result.total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        pages: Math.ceil(result.total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error in /sales endpoint:', error);
    res.status(500).json({
      error: 'Failed to retrieve sales data',
      details: error.message
    });
  }
});

/**
 * GET /api/mercadolibre/heatmap-data
 * Get aggregated sales data by location for heatmap
 * Requires: admin role
 */
mercadolibreRouter.get('/heatmap-data', auth.requireAuth, auth.requireAdmin, async (req, res) => {
  try {
    const mlService = new MercadoLibreService(process.env.ML_ACCESS_TOKEN);
    const data = await mlService.getSalesHeatmapData();

    res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('Error in /heatmap-data endpoint:', error);
    res.status(500).json({
      error: 'Failed to retrieve heatmap data',
      details: error.message
    });
  }
});

/**
 * GET /api/mercadolibre/stats
 * Get sales statistics
 * Requires: admin role
 */
mercadolibreRouter.get('/stats', auth.requireAuth, auth.requireAdmin, async (req, res) => {
  try {
    const statsResult = await db.query(`
      SELECT 
        COUNT(*) as total_orders,
        SUM(total_amount) as total_revenue,
        AVG(total_amount) as avg_order_value,
        COUNT(DISTINCT recipient_city) as unique_cities,
        COUNT(DISTINCT recipient_state) as unique_states,
        MIN(purchase_date) as first_order_date,
        MAX(purchase_date) as last_order_date
      FROM sales_tracking
    `, []);

    const topCitiesResult = await db.query(`
      SELECT 
        recipient_city,
        COUNT(*) as order_count,
        SUM(total_amount) as total_sales
      FROM sales_tracking
      GROUP BY recipient_city
      ORDER BY order_count DESC
      LIMIT 10
    `, []);

    res.json({
      success: true,
      overview: statsResult.rows[0],
      top_cities: topCitiesResult.rows
    });
  } catch (error) {
    console.error('Error in /stats endpoint:', error);
    res.status(500).json({
      error: 'Failed to retrieve statistics',
      details: error.message
    });
  }
});
