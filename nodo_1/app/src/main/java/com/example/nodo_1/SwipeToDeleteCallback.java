package com.example.nodo_1;

import android.animation.ObjectAnimator;
import android.graphics.Canvas;
import android.graphics.drawable.Drawable;

import androidx.annotation.NonNull;
import androidx.core.content.ContextCompat;
import androidx.recyclerview.widget.ItemTouchHelper;
import androidx.recyclerview.widget.RecyclerView;

import adapter.adap_mensajes;
public class SwipeToDeleteCallback extends ItemTouchHelper.SimpleCallback {

    private adap_mensajes adapter;
    private float maxSwipeX;

    public SwipeToDeleteCallback(adap_mensajes adapter, float maxSwipeX) {
        super(0, ItemTouchHelper.RIGHT);
        this.adapter = adapter;
        this.maxSwipeX = maxSwipeX;
    }

    @Override
    public int getMovementFlags(@NonNull RecyclerView recyclerView, @NonNull RecyclerView.ViewHolder viewHolder) {
        // Allow right swipe only
        return makeMovementFlags(0, ItemTouchHelper.RIGHT);
    }

    @Override
    public boolean onMove(
            @NonNull RecyclerView recyclerView,
            @NonNull RecyclerView.ViewHolder viewHolder,
            @NonNull RecyclerView.ViewHolder target
    ) {
        // We are not handling move events
        return false;
    }

    @Override
    public void onSwiped(@NonNull RecyclerView.ViewHolder viewHolder, int direction) {
        // Get the position of the swiped item
        int position = viewHolder.getAdapterPosition();
        // Trigger the reply action
        adapter.reply_deslizar(position);
        // Notify the adapter to redraw the item, resetting its state
        adapter.notifyItemChanged(position);
    }

    @Override
    public float getSwipeThreshold(@NonNull RecyclerView.ViewHolder viewHolder) {
        // Calculate threshold based on maxSwipeX and item width
        return maxSwipeX / viewHolder.itemView.getWidth();
    }

    @Override
    public void onChildDraw(
            @NonNull Canvas c,
            @NonNull RecyclerView recyclerView,
            @NonNull RecyclerView.ViewHolder viewHolder,
            float dX,
            float dY,
            int actionState,
            boolean isCurrentlyActive
    ) {
        if (actionState == ItemTouchHelper.ACTION_STATE_SWIPE && dX > 0) {
            // Limit the swipe distance to the specified maximum
            float limitedDx = Math.min(dX, maxSwipeX);

            // Calculate the progress of the swipe as a value between 0 and 1
            float swipeProgress = limitedDx / maxSwipeX;

            // Set the alpha (transparency) of the icon based on swipe progress
            int alpha = (int) (255 * swipeProgress);

            // Draw the reply icon with adjusted transparency
            Drawable replyIcon = ContextCompat.getDrawable(viewHolder.itemView.getContext(), R.drawable.reply_24);

            if (replyIcon != null) {
                // Set the alpha of the drawable
                replyIcon.setAlpha(alpha);

                int itemHeight = viewHolder.itemView.getBottom() - viewHolder.itemView.getTop();
                int intrinsicWidth = replyIcon.getIntrinsicWidth();
                int intrinsicHeight = replyIcon.getIntrinsicHeight();

                // Calculate position of the icon
                int iconLeft = viewHolder.itemView.getLeft() + (int)(limitedDx / 2) - intrinsicWidth / 2;
                int iconTop = viewHolder.itemView.getTop() + (itemHeight - intrinsicHeight) / 2;
                int iconRight = iconLeft + intrinsicWidth;
                int iconBottom = iconTop + intrinsicHeight;

                // Set the icon bounds and draw it
                replyIcon.setBounds(iconLeft, iconTop, iconRight, iconBottom);
                replyIcon.draw(c);
            }

            // Apply the limited translation to the item view
            viewHolder.itemView.setTranslationX(limitedDx);
        } else {
            // Ensure the item is reset
            super.onChildDraw(c, recyclerView, viewHolder, 0, dY, actionState, isCurrentlyActive);
        }
    }
}
