/**
 * MercadoLibre Service
 * Handles integration with MercadoLibre API for order synchronization
 */

import * as db from '../db.js';

class MercadoLibreService {
  constructor(accessToken) {
    this.accessToken = accessToken;
    this.baseUrl = 'https://api.mercadolibre.com';
  }

  /**
   * Fetch orders from MercadoLibre API
   * @param {string} sellerId - Seller ID in MercadoLibre
   * @returns {Promise<Array>} Array of orders
   */
  async fetchOrders(sellerId) {
    try {
      const url = `${this.baseUrl}/orders/search?seller_id=${sellerId}&sort=date_desc&limit=100`;
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`MercadoLibre API error: ${response.status}`);
      }

      const data = await response.json();
      return data.results || [];
    } catch (error) {
      console.error('Error fetching orders from MercadoLibre:', error);
      throw error;
    }
  }

  /**
   * Fetch order details from MercadoLibre
   * @param {number} orderId - Order ID
   * @returns {Promise<Object>} Order details
   */
  async fetchOrderDetails(orderId) {
    try {
      const url = `${this.baseUrl}/orders/${orderId}`;
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch order ${orderId}: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`Error fetching order details for ${orderId}:`, error);
      throw error;
    }
  }

  /**
   * Fetch shipment details
   * @param {number} shipmentId - Shipment ID
   * @returns {Promise<Object>} Shipment details
   */
  async fetchShipment(shipmentId) {
    try {
      const url = `${this.baseUrl}/shipments/${shipmentId}`;
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch shipment ${shipmentId}: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`Error fetching shipment ${shipmentId}:`, error);
      throw error;
    }
  }

  /**
   * Transform order data for storage in our database
   * @param {Object} order - Order data from MercadoLibre
   * @param {Object} orderDetails - Detailed order information
   * @param {Object} shipment - Shipment information
   * @returns {Promise<Object>} Transformed data
   */
  async transformOrderData(order, orderDetails, shipment) {
    try {
      // Extract products information
      const products = (orderDetails.order_items || []).map(item => ({
        id: item.item.id,
        title: item.item.title,
        quantity: item.quantity,
        unit_price: item.unit_price,
        full_price: item.full_price
      }));

      // Extract shipping address
      const shippingAddress = orderDetails.shipping?.shipping_address || {};
      
      // Determine city and state
      let city = shippingAddress.city?.name || 'Unknown';
      let state = shippingAddress.state?.name || 'Unknown';
      let country = 'AR'; // Default to Argentina
      let zipCode = shippingAddress.zip_code || '';

      // Get shipping method
      let shippingMethod = 'Unknown';
      if (shipment && shipment.shipment_type) {
        shippingMethod = shipment.shipment_type;
      } else if (orderDetails.shipping) {
        shippingMethod = orderDetails.shipping.shipping_method?.name || 'Standard';
      }

      // Get order status
      const orderStatus = orderDetails.status || order.status || 'pending';

      // Calculate approximate coordinates based on city (this is a simplified approach)
      const { latitude, longitude } = await this.getApproximateCoordinates(city, state, country);

      return {
        ml_order_id: order.id,
        purchase_date: new Date(order.date_created),
        total_amount: order.total_amount || orderDetails.total_amount || 0,
        order_status: orderStatus,
        shipping_method: shippingMethod,
        recipient_city: city,
        recipient_state: state,
        recipient_country: country,
        recipient_zip_code: zipCode,
        latitude: latitude,
        longitude: longitude,
        products: JSON.stringify(products)
      };
    } catch (error) {
      console.error('Error transforming order data:', error);
      throw error;
    }
  }

  /**
   * Get approximate coordinates for a city
   * In production, you might want to use a geocoding service like Google Maps or Nominatim
   * @param {string} city - City name
   * @param {string} state - State/Province name
   * @param {string} country - Country code
   * @returns {Promise<Object>} {latitude, longitude}
   */
  async getApproximateCoordinates(city, state, country) {
    // This is a simplified implementation
    // In production, integrate with Nominatim or similar geocoding service
    
    const cityCoordinates = {
      // Argentina - Major Cities
      'buenos aires': { lat: -34.6037, lng: -58.3816 },
      'córdoba': { lat: -31.4135, lng: -64.1811 },
      'rosario': { lat: -32.9468, lng: -60.6393 },
      'mendoza': { lat: -32.8897, lng: -68.8459 },
      'la plata': { lat: -34.9205, lng: -57.9543 },
      'mar del plata': { lat: -38.0055, lng: -57.5604 },
      'san juan': { lat: -31.5375, lng: -68.5186 },
      'tucumán': { lat: -26.8241, lng: -65.2226 },
      'catamarca': { lat: -28.4696, lng: -65.4848 },
      'corrientes': { lat: -27.4805, lng: -58.8345 },
      'posadas': { lat: -27.3622, lng: -55.5038 },
      'puerto iguazú': { lat: -25.5951, lng: -54.5775 },
      'salta': { lat: -24.7859, lng: -65.4060 },
      'jujuy': { lat: -23.8105, lng: -65.2995 },
      'formosa': { lat: -25.5601, lng: -60.9993 },
      'resistencia': { lat: -27.4614, lng: -58.9863 },
      'santiago del estero': { lat: -27.7951, lng: -64.2637 },
      'santa fe': { lat: -31.6333, lng: -60.7000 },
      'paraná': { lat: -31.7333, lng: -60.5236 },
      'la rioja': { lat: -29.4122, lng: -66.3572 },
      'san luis': { lat: -33.2793, lng: -66.3350 },
      'neuquén': { lat: -38.9516, lng: -68.0591 },
      'viedma': { lat: -40.8087, lng: -63.0013 },
      'comodrivadavia': { lat: -43.3008, lng: -65.4858 },
      'rawson': { lat: -43.2987, lng: -65.1009 },
      'ushuaia': { lat: -54.8019, lng: -68.3030 }
    };

    const key = city.toLowerCase().trim();
    if (cityCoordinates[key]) {
      return {
        latitude: cityCoordinates[key].lat,
        longitude: cityCoordinates[key].lng
      };
    }

    // Default to Buenos Aires if city not found
    console.warn(`Coordinates not found for city: ${city}, using Buenos Aires as default`);
    return { latitude: -34.6037, longitude: -58.3816 };
  }

  /**
   * Save sales data to database
   * @param {Array<Object>} salesData - Array of transformed sales data
   * @returns {Promise<Array>} Array of inserted IDs
   */
  async saveSalesData(salesData) {
    try {
      const insertedIds = [];

      for (const sale of salesData) {
        // Check if order already exists
        const existingResult = await db.query(
          'SELECT id FROM sales_tracking WHERE ml_order_id = ?',
          [sale.ml_order_id]
        );

        if (existingResult.rows.length === 0) {
          // Insert new sale
          const result = await db.query(
            `INSERT INTO sales_tracking 
            (ml_order_id, purchase_date, total_amount, order_status, shipping_method, 
             recipient_city, recipient_state, recipient_country, recipient_zip_code, 
             latitude, longitude, products) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              sale.ml_order_id,
              sale.purchase_date,
              sale.total_amount,
              sale.order_status,
              sale.shipping_method,
              sale.recipient_city,
              sale.recipient_state,
              sale.recipient_country,
              sale.recipient_zip_code,
              sale.latitude,
              sale.longitude,
              sale.products
            ]
          );
          insertedIds.push(result.rows.insertId || sale.ml_order_id);
        } else {
          // Update existing sale
          await db.query(
            `UPDATE sales_tracking 
            SET purchase_date = ?, total_amount = ?, order_status = ?, shipping_method = ?, 
                recipient_city = ?, recipient_state = ?, recipient_country = ?, 
                recipient_zip_code = ?, latitude = ?, longitude = ?, products = ?, 
                updated_at = CURRENT_TIMESTAMP 
            WHERE ml_order_id = ?`,
            [
              sale.purchase_date,
              sale.total_amount,
              sale.order_status,
              sale.shipping_method,
              sale.recipient_city,
              sale.recipient_state,
              sale.recipient_country,
              sale.recipient_zip_code,
              sale.latitude,
              sale.longitude,
              sale.products,
              sale.ml_order_id
            ]
          );
          insertedIds.push(existingResult.rows[0].id);
        }
      }

      return insertedIds;
    } catch (error) {
      console.error('Error saving sales data to database:', error);
      throw error;
    }
  }

  /**
   * Get all synced sales from database
   * @param {Object} options - Filter options {limit, offset, city, state, dateFrom, dateTo}
   * @returns {Promise<Object>} {data, total}
   */
  async getSalesData(options = {}) {
    try {
      const { limit = 50, offset = 0, city = null, state = null, dateFrom = null, dateTo = null } = options;

      let query = 'SELECT * FROM sales_tracking WHERE 1=1';
      const params = [];

      if (city) {
        query += ' AND recipient_city = ?';
        params.push(city);
      }

      if (state) {
        query += ' AND recipient_state = ?';
        params.push(state);
      }

      if (dateFrom) {
        query += ' AND purchase_date >= ?';
        params.push(new Date(dateFrom));
      }

      if (dateTo) {
        query += ' AND purchase_date <= ?';
        params.push(new Date(dateTo));
      }

      // Get total count
      const countResult = await db.query(
        query.replace('SELECT *', 'SELECT COUNT(*) as total'),
        params
      );
      const total = countResult.rows[0].total;

      // Get paginated data
      query += ' ORDER BY purchase_date DESC LIMIT ? OFFSET ?';
      params.push(limit, offset);

      const dataResult = await db.query(query, params);

      // Parse products JSON
      const parsedData = dataResult.rows.map(sale => ({
        ...sale,
        products: JSON.parse(sale.products)
      }));

      return { data: parsedData, total };
    } catch (error) {
      console.error('Error fetching sales data:', error);
      throw error;
    }
  }

  /**
   * Get sales statistics by city for heatmap
   * @returns {Promise<Array>} Array of {city, state, latitude, longitude, count, total_amount}
   */
  async getSalesHeatmapData() {
    try {
      const query = `
        SELECT 
          recipient_city as city,
          recipient_state as state,
          latitude,
          longitude,
          COUNT(*) as order_count,
          SUM(total_amount) as total_sales
        FROM sales_tracking
        WHERE latitude IS NOT NULL AND longitude IS NOT NULL
        GROUP BY recipient_city, recipient_state, latitude, longitude
        ORDER BY order_count DESC
      `;

      const result = await db.query(query, []);
      return result.rows;
    } catch (error) {
      console.error('Error fetching heatmap data:', error);
      throw error;
    }
  }
}

export default MercadoLibreService;
