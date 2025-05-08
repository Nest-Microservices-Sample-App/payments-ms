import { Injectable } from '@nestjs/common';
import { envs } from 'src/config';
import Stripe from 'stripe';
import { PaymentSessionDto } from './dto';
import { Request, Response } from 'express';

@Injectable()
export class PaymentsService {

    private readonly stripe = new Stripe(envs.stripe_secret);

    async createPaymentSession(paymentSessionDto: PaymentSessionDto) {

        const { currency, items, orderId } = paymentSessionDto;

        const lineItems = items.map(item => {
            return {
                price_data: {
                    currency: currency,
                    product_data: {
                        name: item.name,
                        description: item.description,
                    },
                    unit_amount: Math.round(item.price * 100), // 20.00 EUR
                },
                quantity: item.quantity
            }
        })

        const session = this.stripe.checkout.sessions.create({
            // Set OrderId in here
            payment_intent_data: {
                metadata: {
                    orderId: orderId
                }
            },
            line_items: lineItems,
            mode: 'payment',
            success_url: envs.stripe_success_url,
            cancel_url: envs.stripe_cancel_url,
        });

        return session;
    }

    async stripeWebhook(req: Request, res: Response) {
        const sig = req.headers['stripe-signature'] as string;
        const endpointSecret = envs.stripe_endpoint_secret;
        
        let event: Stripe.Event;

        try {
            event = this.stripe.webhooks.constructEvent(req['rawBody'], sig, endpointSecret);
            
            const chargeSucceeded = event.data.object as any;

            switch (event.type) {
                case 'charge.succeeded':
                    console.log({
                        metadata: chargeSucceeded.metadata,
                        orderId: chargeSucceeded.metadata.orderId
                    })
                    break;
                
                default:
                    console.log(`${event.type} not handled`);
            }


        } catch (error) {
            res.status(400).send(`Webhook Error: ${error.message}`);
        }

        return res.status(200).send(`Webhook called`);
    }

}
