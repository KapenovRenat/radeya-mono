"use client";


import React from 'react';
import {Loader} from "@/components/loader";

function ProductsPage() {
    return (
        <div className="space-y-6">
            Старица с Товарами
            <Loader size={32} hideLabel />

            <div>

            </div>
        </div>
    );
}

export default ProductsPage;